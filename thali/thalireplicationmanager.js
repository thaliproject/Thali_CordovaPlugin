'use strict';

var ThaliEmitter = require('./thaliemitter');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var net = require('net');
var tcpMultiplex = require('./tcpmultiplex');
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
  this._isInRetry = {};
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

  this._serverBridge = tcpMultiplex.muxServerBridge(port);
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
    return this.stop();
  }

  if (status.isAvailable && !this._isStarted) {
    return this.start(this._deviceName, this._port, this._dbName);
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
  if (!peer) { console.log('peer not found', peerIdentifier); return; }
  if (peer && !peer.peerAvailable) { console.log('peer not available', peerIdentifier); return; }

  this._emitter.connect(peer.peerIdentifier, function (err, port) {
    if (err) {
      console.log('Connect error with error: %s', err);
      this.emit(ThaliReplicationManager.events.CONNECT_ERROR, err);
      setImmediate(this._syncRetry.bind(this, peerIdentifier));
    } else {
      var client = tcpMultiplex.muxClientBridge(port, function (err) {
        if (err) {
          console.log('Error in mux client bridge %s', err);
          setImmediate(this._syncRetry.bind(this, peerIdentifier));
        }
        this._clients[peer.peerIdentifier] = client;
        client.listen(function () {
          var localPort = client.address().port;

          var remoteDB = 'http://localhost:' + localPort + '/db/' + this._dbName;
          var options = { live: true, retry: true };
          this._replications[peer.peerIdentifier] = {
            from: this._db.replicate.from(remoteDB, options),
            to: this._db.replicate.to(remoteDB, options)
          };
        }.bind(this));
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
  if (this._isInRetry[peerIdentifier]) { return; }
  this._isInRetry[peerIdentifier] = true;

  var existingClient = this._clients[peerIdentifier];
  if (existingClient) {
    try {
      existingClient.close();
    } catch (e) {
      console.log('Client close with error: %s', e);
    }

    delete this._clients[peerIdentifier];
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
