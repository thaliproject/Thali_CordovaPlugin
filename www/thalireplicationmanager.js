require('./polyfills');
var ThaliEmitter = require('./thaliemitter');

var PEER_AVAILABILITY_CHANGED = ThaliEmitter.events.PEER_AVAILABILITY_CHANGED;

function ThaliReplicationManager(db, emitter) {
  this._db = db;
  this._emitter = (emitter || new ThaliEmitter());
  this._replications = [];
  this._isStarted = false;
}

ThaliReplicationManager.prototype.start = function (cb) {
  var self = this;
  this._emitter.startBroadcasting(function (err) {
    if (err) {
      self._isStarted = false;
      cb(err);
    }
    self._isStarted;
    self._emitter.addListener(PEER_AVAILABILITY_CHANGED, syncPeers.bind(self));
    cb();
  });
};

ThaliReplicationManager.prototype.stop = function (cb) {
  if (!this._isStarted) { throw new Error('.start must be called before stop'); }

  var self = this;
  this._emitter.stopBroadcasting(function (err) {
    if (err) { return cb(err); }
    self._emitter.removeAllListeners(PEER_AVAILABILITY_CHANGED);
    self.replications.forEach(function (item) { item.replication.cancel(); });
    self._isStarted = false;
    cb();
  });
};

function syncPeers(peers) {
  var self = this;

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
    }

  }, this);
}

function syncPeer(peer, error) {
  var self = this;

  // TODO: Check the incoming error

  this._emitter.connect(peer.peerIdentifier, function (err, port) {
    if (err) {
      // TODO: Handle error
    } else {
      var remoteDB = 'http://localhost:' + port + '/' + self.db._db_name;
      var options = { live: true };
      self._replications.push({
        replication: self._db.replicate.from(remoteDB, options)
          .on('error', syncPeer.bind(self, peer)),
        peerIdentifier: peer.peerIdentifier
      }, {
        replication: self._db.replicate.to(remoteDB, options)
          .on('error', syncPeer.bind(self, peer)),
        peerIdentifier: peer.peerIdentifier
      })
    }
  });
}

module.exports = ThaliReplicationManager;
