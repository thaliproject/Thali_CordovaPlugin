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
  this._peers = {};
  this._replications = {};
  this._clients = {};
  this._isStarted = false;
  this._serverBridge = null;
  this._serverBridgePort = 0;
  this._isInRetry = false;
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
  SYNC_ERROR: 'syncError'
};

/**
* Starts the Thali replication manager with the given device name and port number
* @param {String} deviceName the device name to advertise.
* @param {Number} port the port number used for synchronization.
* @param {String} dbName the name of the database.
*/
ThaliReplicationManager.prototype.start = function (deviceName, port, dbName) {
  validations.ensureNonNullOrEmptyString(deviceName, 'deviceName');
  validations.ensureValidPort(port);
  validations.ensureNonNullOrEmptyString(dbName, 'dbName');

  this.emit(ThaliReplicationManager.events.STARTING);

  this._port = port;
  this._deviceName = deviceName;
  this._dbName = dbName;
  if (this._isStarted || !!this._serverBridge) {
    return this.emit(ThaliReplicationManager.events.START_ERROR, new Error('There is already an existing serverBridge instance.'));
  }

  this._serverBridge = muxServerBridge.call(this, port);
  this._serverBridge.listen(function () {
    this._serverBridgePort = this._serverBridge.address().port;

    this._emitter.startBroadcasting(deviceName, this._serverBridgePort, function (err) {
      if (err) {
        this._isStarted = false;
        this.emit(ThaliReplicationManager.events.START_ERROR, err);
      } else {
        this._isStarted = true;
        this._emitter.addListener(PEER_AVAILABILITY_CHANGED, this._syncPeers.bind(this));
        this._emitter.addListener(NETWORK_CHANGED, this._networkChanged.bind(this));
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
    this._emitter.removeAllListeners(PEER_AVAILABILITY_CHANGED);
    this._emitter.removeAllListeners(NETWORK_CHANGED);

    Object.keys(this._replications).forEach(function (key) {
      var item = this._replications[key];
      item.from.cancel();
      item.to.cancel();
    }, this);

    this._serverBridge.close();
    this._serverBridge = null;
    this._isStarted = false;

    if (err) {
      this.emit(ThaliReplicationManager.events.STOP_ERROR, err);
    } else {
      this.emit(ThaliReplicationManager.events.STOPPED);
    }
  }.bind(this));
};

/**
 * Reacts to the networkChanged event to start or stop based upon its current status.
 */
ThaliReplicationManager.prototype._networkChanged = function (status) {
  if (!status.isAvailable && this._isStarted) {
    this.stop();
  }

  if (status.isAvailable && !this._isStarted) {
    this.start(this._deviceName, this._port, this._dbName);
  }
};

/**
 * Synchronizes the peers from the peerAvailabiltyChanged event.
 * @param {Object} peers Peers to sync which contain the peerIdentifier, peerAvailable and peerName.
 */
ThaliReplicationManager.prototype._syncPeers = function (peers) {
  // Get a list of peers for later for checking if available
  this._peers = peers.reduce(function (acc, peer) {
    acc[peer.peerIdentifier] = peer; return acc;
  }, {});

  peers.forEach(function (peer) {

    var p = this._replications[peer.peerIdentifier];

    !p && peer.peerAvailable && this._syncPeer(peer.peerIdentifier);

    if (p && !peer.peerAvailable) {
      var client = this._clients[peer.peerIdentifier];
      if (client) {
        this._clients[peer.peerIdentifier].close(function (err) {
          if(err) {
            console.log('Client close error with error: %s', err);
            this.emit(ThaliReplicationManager.events.DISCONNECT_ERROR, err);
          }
        });
        delete this._clients[peer.peerIdentifier];
      }

      p.from.cancel();
      p.to.cancel();
      delete this._replications[peer.peerIdentifier];

      this._emitter.disconnect(peer.peerIdentifier, function (err) {
        if (err) {
          console.log('Disconnect error with error: %s', err);
          this.emit(ThaliReplicationManager.events.DISCONNECT_ERROR, err);
        }
      }.bind(this));
    }
  }, this);
};

/**
 * Synchronizes a single peer with the given peer identifier
 * @param {String} peerIdentifier The peer identifier to synchronize with.
 */
ThaliReplicationManager.prototype._syncPeer = function (peerIdentifier) {
  var peer = this._peers[peerIdentifier];
  if (!peer) { console.log('peer not found', peerIdentifier); return; }
  if (peer && !peer.peerAvailable) { console.log('peer not available', peerIdentifier); return; }

  this._emitter.connect(peer.peerIdentifier, function (err, port) {
    if (err) {
      console.log('Connect error with error: %s', err);
      this.emit(ThaliReplicationManager.events.CONNECT_ERROR, err);
      setImmediate(this._syncRetry.bind(this, peerIdentifier));
    } else {
      var client = muxClientBridge.call(this, port, peerIdentifier);
      this._clients[peer.peerIdentifier] = client;
      client.listen(function () {
        var localPort = client.address().port;

        var remoteDB = 'http://localhost:' + localPort + '/db/' + this._dbName;
        var options = { live: true, retry: true };
        this._replications[peer.peerIdentifier] = {
          from: this._db.replicate.from(remoteDB, options),
          to: this._db.replicate.to(remoteDB, options)
        }
      }.bind(this));
    }
  }.bind(this));
};

/**
 * Retry a synchronization after a failture with the given peer identifier. This tears down
 * all the client replications so that we can have a clean sync retry
 * @param {String} peerIdentifier The peer identifier to retry the synchronization with.
 */
ThaliReplicationManager.prototype._syncRetry = function (peerIdentifier) {
  if (this._isInRetry) { return; }
  this._isInRetry = true;

  var c = this._clients[peerIdentifier];
  if (c) {
    try {
      c.close();
    } catch (e) {
      console.log('Client close with error: %s', e);
    }

    delete this._clients[peerIdentifier];
  }
  var p = this._replications[peerIdentifier];
  if (p) {
    p.from.cancel();
    p.to.cancel();
    delete this._replications[peerIdentifier];
  }

  this._emitter.disconnect(peerIdentifier, function (err) {
    if (err) {
      console.log('Disconnect error with error: %s', err);
      this.emit(ThaliReplicationManager.events.DISCONNECT_ERROR, err);
    }
    this._isInRetry = false;
    this._syncPeer(peerIdentifier);
  }.bind(this));
};

/* Mux Layer */

function restartMuxServerBridge() {
  this.once('stopped', function () {
    this.start(this._deviceName, this._port, this._dbName);
  }.bind(this));

  this.stop();
}

function muxServerBridge(tcpEndpointServerPort) {
  var serverRestarted = false;

  var serverPlex = multiplex({}, function(stream, id) {
    var clientSocket = net.createConnection({port: tcpEndpointServerPort});
    stream.pipe(clientSocket).pipe(stream);
  });

  var server = net.createServer(function(incomingClientSocket) {

    incomingClientSocket.on('error', function (err) {
      console.log('incoming client socket error %s', err);

      if (!serverRestarted) {
        try {
          serverPlex.destroy();
          server.close();
        } catch (e) {
          console.log('failed to clean up server and serverPlex');
        }

        restartMuxServerBridge.call(this);
        serverRestarted = true;
      }

    }.bind(this));

    server.on('error', function (err) {
      console.log('mux server bridge error %s', err);
      if (!serverRestarted) {
        try {
          incomingClientSocket.destroy();
          serverPlex.destroy();
        } catch (e) {
          console.log('failed to clean up server and serverPlex');
        }

        restartMuxServerBridge.call(this);
        serverRestarted = true;
      }
    }.bind(this));

    server.on('close', function () {
      console.log('mux server bridge close');
      if (!serverRestarted) {
        try {
          serverPlex.destroy();
        } catch (e) {
          console.log('failed to clean up server and serverPlex');
        }
        restartMuxServerBridge.call(this);
        serverRestarted = true;
      }
    }.bind(this));

    incomingClientSocket.pipe(serverPlex).pipe(incomingClientSocket);
  });

  server.setMaxListeners(100);

  return server;
}

function muxClientBridge(localP2PTcpServerPort, peerIdentifier) {
  var clientPlex = multiplex();
  var clientSocket = net.createConnection({port: localP2PTcpServerPort});

  var server = net.createServer(function(incomingClientSocket) {
    var clientStream = clientPlex.createStream();
    incomingClientSocket.pipe(clientStream).pipe(incomingClientSocket);
  });

  cleanUpSocket(clientSocket, function() {
    clientPlex.destroy();
    try {
      server.close();
    } catch(e) {
      this.emit(ThaliReplicationManager.events.SYNC_ERROR, e);
    }
    setImmediate(this._syncRetry.bind(this, peerIdentifier));
  }.bind(this));

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
