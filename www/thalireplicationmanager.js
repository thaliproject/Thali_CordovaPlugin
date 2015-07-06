'use strict';

require('./polyfills');
var ThaliEmitter = require('./thaliemitter');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var net = require('net');
var multiplex = require('multiplex');

var e = new EventEmitter();

var PEER_AVAILABILITY_CHANGED = ThaliEmitter.events.PEER_AVAILABILITY_CHANGED;
var NETWORK_CHANGED = ThaliEmitter.events.NETWORK_CHANGED;

inherits(ThaliReplicationManager, EventEmitter);

function ThaliReplicationManager(db, emitter) {
  this._db = db;
  this._emitter = (emitter || new ThaliEmitter());
  this._replications = [];
  this._clients = {};
  this._isStarted = false;
  this._serverBridge = null;
  this._serverBridgePort = 0;
  EventEmitter.call(this);
}

ThaliReplicationManager.events = {
  STARTING = 'starting',
  STARTED = 'started',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  START_ERROR = 'startError',
  STOP_ERROR = 'stopError',
  CONNECT_ERROR = 'connectError',
  DISCONNECT_ERROR = 'disconnectError',
  SYNC_ERROR = 'syncError'
};

/**
* Starts the Thali replication manager with the given device name and port number
* @param {String} deviceName the device name to advertise.
* @param {Number} port the port number used for synchronization.
*/
ThaliReplicationManager.prototype.start = function (deviceName, port, dbName) {
  this.emit(ThaliReplicationManager.events.STARTING);

  this._dbName = dbName;
  this._serverBridge = muxServerBridge(port);
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
      this._replications.forEach(function (item) { item.replication.cancel(); });
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
    this.start();
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
          this.emit(ThaliReplicationManager.events.DISCONNECT_ERROR, err);
        });
        delete this._clients[peer.peerIdentifier];
      }

      p.from.cancel();
      p.to.cancel();
      delete this._replications[peer.peerIdentifier];

      this._emitter.disconnect(peer.peerIdentifier, function (err) {
        this.emit(ThaliReplicationManager.events.DISCONNECT_ERROR, err);
      }.bind(this));
    }
  }, this);
}

function syncError(peer, error) {
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
    this.emit(ThaliReplicationManager.events.DISCONNECT_ERROR, err);
  }.bind(this));

  this.emit(ThaliReplicationManager.events.SYNC_ERROR, error);
}

function syncPeer(peer) {
  this._emitter.connect(peer.peerIdentifier, function (err, port) {
    if (err) {
      this.emit(ThaliReplicationManager.events.CONNECT_ERROR, err);
    } else {

      var client = muxClientBridge(port);
      this._clients[peer.peerIdentifier] = client;
      client.listen(function () {
        var localPort = client.address().port;

        var remoteDB = 'http://localhost:' + localPort + '/' + this._dbName;
        var options = { live: true };
        this._replications[peer.peerIdentifier] = {
          from: this._db.replicate.from(remoteDB, options)
            .on('error', syncError.bind(this, peer)),
          to: this._db.replicate.from(remoteDB, options)
            .on('error', syncError.bind(this, peer));
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
    cleanUpSocket(clientSocket, function() { stream.destroy(); });
    cleanUpSocket(stream, function() { clientSocket.destroy(); });
  });

  var server = net.createServer(function(incomingClientSocket) {
    cleanUpSocket(incomingClientSocket, function() {
      serverPlex.destroy();
      server.close();
    });
    incomingClientSocket.pipe(serverPlex).pipe(incomingClientSocket);
  });

  cleanUpSocket(server, function() {
    serverPlex.destroy();
    server.close();
  });

  return server;
}

function muxClientBridge(localP2PTcpServerPort) {
  var clientPlex = multiplex();
  var clientSocket = net.createConnection({port: localP2PTcpServerPort});
  var incomingTCPConnectionSockets = {};
  var socketIdCounter = 0;

  var server = net.createServer(function(incomingClientSocket) {
    var localSocketId = socketIdCounter++;
    incomingTCPConnectionSockets[localSocketId] = incomingClientSocket;

    var clientStream = clientPlex.createStream();
    incomingClientSocket.pipe(clientStream).pipe(incomingClientSocket);

    cleanUpSocket(incomingClientSocket, function() {
      clientStream.destroy();
      delete incomingTCPConnectionSockets[localSocketId];
    });
  });

  cleanUpSocket(clientSocket, function() {
    clientPlex.destroy();
    server.close();
    incomingTCPConnectionSockets.foreach(function(socketId) {
      incomingTCPConnectionSockets[socketId].destroy();
    });
  });

  clientPlex.pipe(clientSocket).pipe(clientPlex);

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

module.exports = ThaliReplicationManager;
