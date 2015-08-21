'use strict';

var ThaliEmitter = require('./thaliemitter');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var net = require('net');
var multiplex = require('multiplex');
var validations = require('./validations');
var cryptomanager = require('./thalicryptomanager');

var deviceIdentityFlag = {
  noDeviceIdentitySet: 0,
  gettingDeviceIdentity: 1,
  deviceIdentityAvailable: 2
};

var e = new EventEmitter();

var PEER_AVAILABILITY_CHANGED = ThaliEmitter.events.PEER_AVAILABILITY_CHANGED;
var NETWORK_CHANGED = ThaliEmitter.events.NETWORK_CHANGED;

inherits(ThaliReplicationManager, EventEmitter);

function ThaliReplicationManager(db, emitter) {
  this._deviceName = '';
  this._deviceIdentityFlag = deviceIdentityFlag.noDeviceIdentitySet;
  this._deviceIdentityListeners = [];
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
  SYNC_ERROR: 'syncError'
};

/**
* Returns the current device's id if available. If not, the provided callback
* function is saved and called when the id does become available.
* @param {Function} cb the callback which returns the current device's id.
*/
ThaliReplicationManager.prototype.getDeviceIdentity = function (cb) {
  if(this._deviceIdentityFlag == deviceIdentityFlag.deviceIdentityAvailable) {
    cb(null, this._deviceName);
    return;
  }

  if(this._deviceIdentityFlag == deviceIdentityFlag.noDeviceIdentitySet) {
    this._deviceIdentityFlag = deviceIdentityFlag.gettingDeviceIdentity;
    // save the callback for future
    this._deviceIdentityListeners.push(cb);
    cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
      if (err) {
        this._deviceIdentityFlag = deviceIdentityFlag.noDeviceIdentitySet;
      } else {
        this._deviceName = publicKeyHash;
        this._deviceIdentityFlag = deviceIdentityFlag.deviceIdentityAvailable;
      }

      // save the list of device-identity-listeners locally and clear the
      // global list. this will avoid a potential race condition if one of
      // the callback functions tries to get the device identity again
      // immediately.
      var localCopyOfListeners = this._deviceIdentityListeners.slice();
      this._deviceIdentityListeners = [];
      localCopyOfListeners.forEach(function (listener) {
        listener(err, publicKeyHash);
      });
    }.bind(this));
    return;
  }

  if(this._deviceIdentityFlag == deviceIdentityFlag.gettingDeviceIdentity) {
    // save the callback for future
    this._deviceIdentityListeners.push(cb);
    return;
  }

  throw new Error('deviceIdentityFlag is set to unknown state');
};

/**
* Starts the Thali replication manager with the given port number and db name.
* The device-id is obtained using the cryptomanager's API.
* @param {Number} port the port number used for synchronization.
* @param {String} dbName the name of the database.
*/
ThaliReplicationManager.prototype.start = function (port, dbName) {
  validations.ensureValidPort(port);
  validations.ensureNonNullOrEmptyString(dbName, 'dbName');
  
  this.getDeviceIdentity.call(this, function(err, publicKeyHash) {
    if(err) {
      this._isStarted = false;
      this.emit(ThaliReplicationManager.events.START_ERROR, err);
      return;
    }
    startReplicationManager.call(this, port, dbName);
  }.bind(this));
};

function startReplicationManager(port, dbName) {
  this.emit(ThaliReplicationManager.events.STARTING);

  this._port = port;
  this._dbName = dbName;
  if (this._isStarted || !!this._serverBridge) {
    return this.emit(ThaliReplicationManager.events.START_ERROR, new Error('There is already an existing serverBridge instance.'));
  }

  this._serverBridge = muxServerBridge.call(this, port);
  this._serverBridge.listen(function () {
    this._serverBridgePort = this._serverBridge.address().port;

    this._emitter.startBroadcasting(this._deviceName, this._serverBridgePort, function (err) {
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
}

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

    !p && peer.peerAvailable && syncPeer.call(this, peer);

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
      var client = muxClientBridge.call(this, port, peer);
      this._clients[peer.peerIdentifier] = client;
      client.listen(function () {
        var localPort = client.address().port;

        var remoteDB = 'http://localhost:' + localPort + '/db/' + this._dbName;
        var options = { live: true, retry: true };
        this._replications[peer.peerIdentifier] = {
          from: this._db.replicate.from(remoteDB, options),
          to: this._db.replicate.from(remoteDB, options)
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
  });

  return net.createServer(function(incomingClientSocket) {
    incomingClientSocket.pipe(serverPlex).pipe(incomingClientSocket);
  });
}

function muxClientBridge(localP2PTcpServerPort, peer) {
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
    syncRetry.call(this, peer);
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
