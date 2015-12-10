'use strict';

var ThaliEmitter = require('./thaliemitter');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var net = require('net');
var tcpMultiplex = require('./tcpmultiplex');
var validations = require('./validations');
var cryptomanager = require('./thalicryptomanager');

var deviceIdentityFlag = {
  noDeviceIdentitySet: 0,
  gettingDeviceIdentity: 1,
  deviceIdentityAvailable: 2
};

var PEER_AVAILABILITY_CHANGED = ThaliEmitter.events.PEER_AVAILABILITY_CHANGED;
var NETWORK_CHANGED = ThaliEmitter.events.NETWORK_CHANGED;
var CONNECTION_ERROR = ThaliEmitter.events.CONNECTION_ERROR;

inherits(ThaliReplicationManager, EventEmitter);

function ThaliReplicationManager(db, emitter) {
  if (!db) { throw new Error('db is required to inititialize the ThaliReplicationManager'); }

  EventEmitter.call(this);
  console.log('DB value for ThaliReplicationManager is: %s', JSON.stringify(db));
  this._db = db;
  this._emitter = (emitter || new ThaliEmitter());
  this.clearState();
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
  SYNC_ERROR: 'syncError',
  CONNECTION_SUCCESS: 'connectionSuccess'
};

ThaliReplicationManager.prototype.clearState = function() {
  this._deviceName = '';
  this._deviceIdentityFlag = deviceIdentityFlag.noDeviceIdentitySet;
  this._deviceIdentityListeners = [];
  this._peers = {};
  this._replications = {};
  this._clients = {};
  this._isStarted = false;
  this._serverBridge = null;
  this._serverBridgePort = 0;
  this._isInRetry = {};
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
 * @param {String} [deviceName] the optional name to advertise for the device
 */
ThaliReplicationManager.prototype.start = function (port, dbName, deviceName) {
  validations.ensureValidPort(port);
  validations.ensureNonNullOrEmptyString(dbName, 'dbName');

  if (deviceName) {
    this._deviceName = deviceName;
    this._start(port, dbName);
  } else {
    this.getDeviceIdentity.call(this, function(err, publicKeyHash) {
      if(err) {
        this._isStarted = false;
        this.emit(ThaliReplicationManager.events.START_ERROR, err);
        return;
      }
      this._start(port, dbName);
    }.bind(this));
  }
};

ThaliReplicationManager.prototype._start = function (port, dbName) {
  this.emit(ThaliReplicationManager.events.STARTING);

  this._port = port;
  this._dbName = dbName;
  if (this._isStarted || !!this._serverBridge) {
    return this.emit(
      ThaliReplicationManager.events.START_ERROR,
      new Error('There is already an existing serverBridge instance.')
    );
  }

  this._serverBridge = tcpMultiplex.muxServerBridge(port);
  this._serverBridge.listen(function () {
    this._serverBridgePort = this._serverBridge.address().port;

    this._emitter.addListener(PEER_AVAILABILITY_CHANGED, this._syncPeers.bind(this));
    this._emitter.addListener(NETWORK_CHANGED, this._networkChanged.bind(this));
    this._emitter.addListener(CONNECTION_ERROR, this._connectionError.bind(this));

    this._emitter.startBroadcasting(this._deviceName, this._serverBridgePort, function (err) {
      if (err) {
        this._isStarted = false;
        this.emit(ThaliReplicationManager.events.START_ERROR, err);
      } else {
        this._isStarted = true;
        this.emit(ThaliReplicationManager.events.STARTED);
      }
    }.bind(this));
  }.bind(this));
};

/**
 * Stops the Thali replication manager
 */
ThaliReplicationManager.prototype.stop = function () {
  console.log('Now in TRM stop');
  console.log('State of this._isStarted: %s', this._isStarted);
  if (!this._isStarted) { throw new Error('.start must be called before stop'); }
  this._isStarted = false;

  // First stop any ongoing replications
  Object.keys(this._replications).forEach(function (key) {
    var item = this._replications[key];
    item.from.cancel();
    item.to.cancel();
  }, this);

  this.emit(ThaliReplicationManager.events.STOPPING);

  console.log('About to call stopBroadcasting');
  this._emitter.stopBroadcasting(function (err) {
    console.log('Got callback from stopBroadcasting with err %s', err);
    this._emitter.removeAllListeners(PEER_AVAILABILITY_CHANGED);
    this._emitter.removeAllListeners(NETWORK_CHANGED);
    this._emitter.removeAllListeners(CONNECTION_ERROR);

    for (var clientIdentifier in this._clients) {
      var existingClient = this._clients[clientIdentifier];
      existingClient.exit(function (e) {
        if (e) {
          console.log('Client close with error: %s', e);
        }
        delete this._clients[clientIdentifier];
      }.bind(this));
    }

    this._serverBridge.exit(function () {
      this._serverBridge = null;

      this.clearState();

      if (err) {
        this.emit(ThaliReplicationManager.events.STOP_ERROR, err);
      } else {
        this.emit(ThaliReplicationManager.events.STOPPED);
      }
    }.bind(this));
  }.bind(this));
};

/**
 * Reacts to the networkChanged event to start or stop based upon its current status.
 */
ThaliReplicationManager.prototype._networkChanged = function (status) {
  if (!status.isAvailable && this._isStarted) {
    return this.stop();
  }

  if (status.isAvailable && !this._isStarted) {
    return this.start(this._deviceName, this._port, this._dbName);
  }
};

/**
 * Handles the connection errors from the native layer for synchronization
 * @param {Object} status A message containing the peerIdentifier for the connection error
 */
ThaliReplicationManager.prototype._connectionError = function (status) {
  this._syncRetry(status.peerIdentifier);
};

/**
 * Synchronizes the peers from the peerAvailabiltyChanged event.
 * @param {Object} peers Peers to sync which contain the peerIdentifier, peerAvailable and peerName.
 */
ThaliReplicationManager.prototype._syncPeers = function (peers) {
  // Get a list of peers for later for checking if available
  this._peers = peers.reduce(function (acc, peer) {
    acc[peer.peerIdentifier] = peer; return acc;
  }, this._peers);

  peers.forEach(function (peer) {

    var existingReplication = this._replications[peer.peerIdentifier];

    !existingReplication && peer.peerAvailable && this._syncPeer(peer.peerIdentifier);

    if (existingReplication && !peer.peerAvailable) {
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

      existingReplication.from.cancel();
      existingReplication.to.cancel();
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
  if (!peer) { console.log('peerIdentifier not found: %s', peerIdentifier); return; }
  if (peer && !peer.peerAvailable) { console.log('peerIdentifier not available %s', peerIdentifier); return; }

  this._emitter.connect(peer.peerIdentifier, function (err, port) {
    if (err) {
      console.log('Connect error with error: %s', err);
      this.emit(ThaliReplicationManager.events.CONNECT_ERROR, err);
      return setImmediate(this._syncRetry.bind(this, peerIdentifier));
    }

    if (!this._isStarted) {
      console.log('Connect callback called while not started');
      return;
    }

    var client = tcpMultiplex.muxClientBridge(port, function (err) {
      if (err) {
        console.log('Error in mux client bridge %s', err);
        return setImmediate(this._syncRetry.bind(this, peerIdentifier));
      }
      this._clients[peer.peerIdentifier] = client;
      client.listen(function () {
        var localPort = client.address().port;

        this.emit(ThaliReplicationManager.events.CONNECTION_SUCCESS, {
          peerIdentifier : peer.peerIdentifier,
          muxPort : localPort
        });

        var remoteDB = 'http://localhost:' + localPort + '/db/' + this._dbName;
        var options = { live: true, retry: true };
        this._replications[peer.peerIdentifier] = {
          from: this._db.replicate.from(remoteDB, options),
          to: this._db.replicate.to(remoteDB, options)
        };
      }.bind(this));
    }.bind(this));
  }.bind(this));
};

/**
 * Retry a synchronization after a failure with the given peer identifier. This tears down
 * all the client replications so that we can have a clean sync retry
 * @param {String} peerIdentifier The peer identifier to retry the synchronization with.
 */
ThaliReplicationManager.prototype._syncRetry = function (peerIdentifier) {
  if (!this._isStarted) {
    return console.log('syncRetry called when not started');
  }
  if (this._isInRetry[peerIdentifier]) {
    return console.log('peerIdentifier already in syncRetry %s', peerIdentifier);
  }

  this._isInRetry[peerIdentifier] = true;

  var existingClient = this._clients[peerIdentifier];
  if (existingClient) {
    existingClient.close(function (e) {
      if (e) {
        console.log('Client close with error: %s', e);
      }
      delete this._clients[peerIdentifier];
    }.bind(this));
  }
  var existingReplication = this._replications[peerIdentifier];
  if (existingReplication) {
    existingReplication.from.cancel();
    existingReplication.to.cancel();
    delete this._replications[peerIdentifier];
  }

  this._emitter.disconnect(peerIdentifier, function (err) {
    if (err) {
      console.log('Disconnect error with error: %s', err);
      this.emit(ThaliReplicationManager.events.DISCONNECT_ERROR, err);
    }
    this._isInRetry[peerIdentifier] = false;
    this._syncPeer(peerIdentifier);
  }.bind(this));
};

module.exports = ThaliReplicationManager;
