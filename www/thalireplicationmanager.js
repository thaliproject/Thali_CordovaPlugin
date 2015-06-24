var ThaliEmitter = require('./thaliemitter');

var PEER_AVAILABILITY_CHANGED = ThaliEmitter.events.PEER_AVAILABILITY_CHANGED;

function ThaliReplicationManager(db) {
  this._db = db;
  this._emitter = new ThaliEmitter();
  this._replications = [];
  this._peers = [];
  this._isStarted = false;
}

ThaliReplicationManager.prototype.start = function (cb) {
  var self = this;

  this._isStarted = true;

  this._emitter.startBroadcasting(function (err) {
    if (err) { return cb(err); }
    self._emitter.addListener(PEER_AVAILABILITY_CHANGED, syncPeers.bind(self));
  });
};

ThaliReplicationManager.prototype.stop = function (cb) {
  if (!this._isStarted) { throw new Error('.start must be called before stop'); }

  var self = this;
  this._emitter.stopBroadcasting(function (err) {
    if (err) { return cb(err); }
    self._emitter.removeAllListeners(PEER_AVAILABILITY_CHANGED);
    self._changes.cancel();
    self._isStarted = false;
  });
};

function syncPeers(peers) {
  for(var i = 0, len = peers.length; i < len; i++) {
    var peer = peers[i];
    var isFound = false;

    for (var pIdx = 0, pLen = this._peers.length; pIdx < pLen; pIdx++) {
      if (this._peers[pIdx].peerIdentifier === peer.peerIdentifier) {
        this._peers[pIdx] = peer;
        isFound = true;
        break;
      }
    }
    if (!isFound) { this._peers.push(peer); }
  }
}

module.exports = ThaliReplicationManager;
