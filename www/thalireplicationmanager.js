require('./polyfills');
var ThaliEmitter = require('./thaliemitter');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var PEER_AVAILABILITY_CHANGED = ThaliEmitter.events.PEER_AVAILABILITY_CHANGED;
var NETWORK_CHANGED = ThaliEmitter.events.NETWORK_CHANGED;

inherits(ThaliReplicationManager, EventEmitter);

function ThaliReplicationManager(db, emitter) {
  this._db = db;
  this._emitter = (emitter || new ThaliEmitter());
  this._replications = [];
  this._isStarted = false;
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
}

/**
* Starts the Thali replication manager
*/
ThaliReplicationManager.prototype.start = function () {
  var this = this;
  this.emit(ThaliReplicationManager.eevents.STARTING);
  this._emitter.startBroadcasting(function (err) {
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
};

/**
* Stops the Thali replication manager
* @param {Function} cb a callback function which returns an error if one occurred.
*/
ThaliReplicationManager.prototype.stop = function () {
  if (!this._isStarted) { throw new Error('.start must be called before stop'); }
  this.emit(ThaliReplicationManager.events.STOPPING);
  var this = this;
  this._emitter.stopBroadcasting(function (err) {
    if (err) {
      this.emit(ThaliReplicationManager.events.STOP_ERROR, err);
    } else {
      this._emitter.removeAllListeners(PEER_AVAILABILITY_CHANGED);
      this._emitter.removeAllListeners(NETWORK_CHANGED);
      this.replications.forEach(function (item) { item.replication.cancel(); });
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

function syncPeers(peers) {
  peers.forEach(function (peer) {

    // Check if already in replication, and if not, add it
    function findPeer (r) { return r.peerIdentifier === peer.peerIdentifier; }
    var peers = this._replications.filter(findPeer);
    var isReplicating  = peers.length === 2;

    if (!isReplicating && peer.peerAvailable) {
      syncPeer.call(this, peer);
    }

    if (isReplicating && !peer.isAvailable) {
      peers[0].replication.cancel();
      peers[1].replication.cancel();

      this._replcations.splice(this._replcations.findIndex(findPeer), 2);
      this._emitter.disconnect(peer.peerIdentifier, function (err) {
        this.emit(ThaliReplicationManager.events.DISCONNECT_ERROR, err);
      }.bind(this));
    }

  }, this);
}

function syncPeer(peer, error) {
  if (error) {
    this.emit(ThaliReplicationManager.events.SYNC_ERROR, error);
  }

  this._emitter.connect(peer.peerIdentifier, function (err, port) {
    if (err) {
      this.emit(ThaliReplicationManager.events.CONNECT_ERROR, err);
    } else {
      var remoteDB = 'http://localhost:' + port + '/' + this.db._db_name;
      var options = { live: true };
      this._replications.push({
        replication: this._db.replicate.from(remoteDB, options)
          .on('error', syncPeer.bind(this, peer)),
        peerIdentifier: peer.peerIdentifier
      }, {
        replication: this._db.replicate.to(remoteDB, options)
          .on('error', syncPeer.bind(this, peer)),
        peerIdentifier: peer.peerIdentifier
      })
    }
  }.bind(this));
}

module.exports = ThaliReplicationManager;
