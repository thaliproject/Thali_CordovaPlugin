'use strict';

var ThaliEmitter = require('./thaliemitter');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var net = require('net');
var multiplex = require('multiplex');
var validations = require('./validations');

var e = new EventEmitter();

var PEER_AVAILABILITY_CHANGED = ThaliEmitter.events.PEER_AVAILABILITY_CHANGED;
var NETWORK_CHANGED = ThaliEmitter.events.NETWORK_CHANGED;

inherits(ThaliReplicationManager, EventEmitter);

function ThaliReplicationManager(db, emitter) {
  this._db = db;
  this._emitter = (emitter || new ThaliEmitter());
  this._replications = {};
  this._clients = {};
  this._isStarted = false;
  this._serverBridge = null;
  this._serverBridgePort = 0;
  EventEmitter.call(this);
}

ThaliReplicationManager.events = {
  STARTING: 'starting',
  STARTED: 'started',
  STOPPING: 'stopping',
  STOPPED: 'stopped',
  START_ERROR: 'startError',
  STOP_ERROR: 'stopError',
  CONNECT_ERROR: 'connectError',
  DISCONNECT_ERROR: 'disconnectError',
  SYNC_ERROR: 'syncRetry'
};

/**
* Starts the Thali replication manager with the given device name and port number
* @param {String} deviceName the device name to advertise.
* @param {Number} port the port number used for synchronization.
*/
ThaliReplicationManager.prototype.start = function (deviceName, port, dbName) {
  validations.ensureNonNullOrEmptyString(deviceName, 'deviceName');
  validations.ensureValidPort(port);
  validations.ensureNonNullOrEmptyString(dbName, 'dbName');

  this.emit(ThaliReplicationManager.events.STARTING);

  this._port = port;
  this._deviceName = deviceName;
  this._dbName = dbName;
  this._serverBridge = muxServerBridge.call(this, port);
  this._serverBridge.listen(function () {
    this._serverBridgePort = this._serverBridge.address().port;

    this._emitter.startBroadcasting(deviceName, this._serverBridgePort, function (err) {
      if (err) {
        this._isStarted = false;
        this.emit(ThaliReplicationManager.events.START_ERROR, err);
      } else {
        this._isStarted = true;
        this._emitter.addListener(PEER_AVAILABILITY_CHANGED, syncPeers.bind(this));
        this._emitter.addListener(NETWORK_CHANGED, networkChanged.bind(this));
        this.emit(ThaliReplicationManager.events.STARTED);
      }
    }.bind(this));
  }.bind(this));
};

/**
* Starts the Thali replication manager with the given device name and port number
* @param {String} deviceName the device name to advertise.
* @param {Number} port the port number used for synchronization.
*/
ThaliReplicationManager.prototype._restart = function () {
  this.emit(ThaliReplicationManager.events.STARTING);

  this._serverBridge = muxServerBridge.call(this, this._port);
  this._serverBridge.listen(function () {
    this._serverBridgePort = this._serverBridge.address().port;
    this.emit(ThaliReplicationManager.events.STARTED);
  }.bind(this));
};

/**
* Stops the Thali replication manager
*/
ThaliReplicationManager.prototype.stop = function () {
  if (!this._isStarted) { throw new Error('.start must be called before stop'); }
  this.emit(ThaliReplicationManager.events.STOPPING);

  this._emitter.stopBroadcasting(function (err) {
    if (err) {
      this.emit(ThaliReplicationManager.events.STOP_ERROR, err);
    } else {
      this._emitter.removeAllListeners(PEER_AVAILABILITY_CHANGED);
      this._emitter.removeAllListeners(NETWORK_CHANGED);

      Object.keys(this._replications).forEach(function (key) {
        var item = this._replications[key];
        item.from.cancel();
        item.to.cancel();
      }, this);

      this._serverBridge.close();
      this._isStarted = false;
      this.emit(ThaliReplicationManager.events.STOPPED);
    }
  });
};

function networkChanged(status) {
  if (!status.isAvailable && this._isStarted) {
    this.stop();
  }

  if (status.isAvailable && !this._isStarted) {
    this.start(this._deviceName, this._port, this._dbName);
  }
}

/* synchronization */

function syncPeers(peers) {
  peers.forEach(function (peer) {

    var p = this._replications[peer.peerIdentifier];

    if (!p && peer.peerAvailable) {
      syncPeer.call(this, peer);
    }

    if (p && !peer.isAvailable) {
      var client = this._clients[peer.peerIdentifier];
      if (client) {
        this._clients[peer.peerIdentifier].close(function (err) {
          err && this.emit(ThaliReplicationManager.events.DISCONNECT_ERROR, err);
        });
        delete this._clients[peer.peerIdentifier];
      }

      p.from.cancel();
      p.to.cancel();
      delete this._replications[peer.peerIdentifier];

      this._emitter.disconnect(peer.peerIdentifier, function (err) {
        err && this.emit(ThaliReplicationManager.events.DISCONNECT_ERROR, err);
      }.bind(this));
    }
  }, this);
}

function syncRetry(peer) {
  var c = this._clients[peer.peerIdentifier];
  if (c) {
    c.close();
    delete this._clients[peer.peerIdentifier];
  }
  var p = this._replications[peer.peerIdentifier];
  if (p) {
    p.from.cancel();
    p.to.cancel();
    delete this._replications[peer.peerIdentifier];
  }

  this._emitter.disconnect(peer.peerIdentifier, function (err) {
    if (err) {
      this.emit(ThaliReplicationManager.events.DISCONNECT_ERROR, err);
    } else {
      syncPeer.call(this, peer);
    }
  }.bind(this));
}

function syncPeer(peer) {
  this._emitter.connect(peer.peerIdentifier, function (err, port) {
    if (err) {
      this.emit(ThaliReplicationManager.events.CONNECT_ERROR, err);
    } else {

      console.log('connect port', port, peer.peerIdentifier);

      var client = muxClientBridge.call(this, port, peer);
      this._clients[peer.peerIdentifier] = client;
      client.listen(function () {
        var localPort = client.address().port;

        console.log('client port', localPort, peer.peerIdentifier);

        var remoteDB = 'http://localhost:' + localPort + '/db/' + this._dbName;
        var options = { live: true, retry: true };
        this._replications[peer.peerIdentifier] = {
          from: this._db.replicate.from(remoteDB, options)
            .on('error', function (err) {
              console.log('from woops', err, peer.peerIdentifier);
            }),
          to: this._db.replicate.from(remoteDB, options)
            .on('error', function (err) {
              console.log('to woops', err, peer.peerIdentifier);
            })
        }
      }.bind(this));
    }
  }.bind(this));
}

/* Mux Layer */

function muxServerBridge(tcpEndpointServerPort) {
  var serverPlex = multiplex({}, function(stream, id) {

    var clientSocket = net.createConnection({port: tcpEndpointServerPort});
    stream.pipe(clientSocket).pipe(stream);

    listenForStreamEvents(stream, 'muxServerBridge + MuxStream');
    listenForStreamEvents(clientSocket, 'muxServerBridge + ClientSocket');
  });

  var server = net.createServer(function(incomingClientSocket) {
    incomingClientSocket.pipe(serverPlex).pipe(incomingClientSocket);
    listenForStreamEvents(incomingClientSocket, 'muxServerBridge + incomingClientSocket');
  });

  listenForStreamEvents(server, 'muxServerBridge - server');

  return server;
}

function muxClientBridge(localP2PTcpServerPort, peer) {
  var clientPlex = multiplex();
  var clientSocket = net.createConnection({port: localP2PTcpServerPort});

  var server = net.createServer(function(incomingClientSocket) {
    var clientStream = clientPlex.createStream();
    incomingClientSocket.pipe(clientStream).pipe(incomingClientSocket);

    listenForStreamEvents(incomingClientSocket, 'muxClientBridge + incomingClientSocket');
    listenForStreamEvents(clientStream, 'muxClientBridge + clientStream');
  });

  cleanUpSocket(clientSocket, function() {
    clientPlex.destroy();
    try {
      server.close();
    } catch(e) {
      console.log('clientSocket cleanup fail %s', e);
      this.emit(ThaliReplicationManager.events.SYNC_ERROR, e);
    }
    syncRetry.call(this, peer);
  }.bind(this));

  clientPlex.pipe(clientSocket).pipe(clientPlex);
  listenForStreamEvents(clientSocket, 'muxClientBridge + clientSocket');
  listenForStreamEvents(server, 'muxClientBridge + server');

  return server;
}

function cleanUpSocket(socket, cleanUpCallBack) {
  var isClosed = false;

  socket.on('end', function() {
    cleanUpCallBack();
    isClosed = true;
  });

  socket.on('error', function(err) {
    cleanUpCallBack(err);
    isClosed = true;
  });

  socket.on('close', function() {
    if (!isClosed) {
      cleanUpCallBack();
      isClosed = true;
    }
  });
}

function listenForStreamEvents(stream, prefixName) {
  stream.on('error', function(err) {
    console.log(prefixName + ' error - ' + err);
  });

  stream.on('end', function() {
    console.log(prefixName + ' end');
  });

  stream.on('close', function() {
    console.log(prefixName + ' close');
  });

  stream.on('data', function(data) {
    console.log(prefixName + '  data  ' + data);
  });
}

module.exports = ThaliReplicationManager;
