var ThaliEmitter = require('thali/thaliemitter');

function testNewFindPeers(testData, name, peerCount, bluetoothAddresses) {
  this.deviceName = name;
  this.testData = testData;
  this.peerCount = peerCount;
  this.bluetoothAddresses = bluetoothAddresses;
}

testNewFindPeers.prototype.start = function() {

  var self = this;

  this.startTime = new Date();
  this.emitter = new ThaliEmitter();

  var discoveredPeers = {};
  this.emitter.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, function(peers) {
    var now = new Date();
    peers.forEach(function(peer) {
      if (!(peer.peerIdentifier in discoveredPeers) && peer.peerAvailable) {
        discoveredPeers[peer.peerIdentifier] = now - startTime;
        if (Object.keys(discoveredPeers).length == self.testData.peerCount) {
          self.reportResults(discoveredPeers);
          self.stop();
        }
      }
    });
  });

  this.emitter.startBroadcasting(this.deviceName, 4242, function (err) {
    if (err) {
      self.reportResults([], err);
      self.stop();
    }
  );
}

testNewFindPeers.prototype.stop = function() {
  this.emitter.stopBroadcasting(function(err) {
    console.log(err);
    this.emitter = null;
  };
}

testNewFindPeers.prototype.reportResults = function(discoveredPeers, err) {

  var results = [];

  for (var peer in discoveredPeers) {
    results.push({
      "peerName": peer.peerName,
      "peerIdentifier": peer.peerIdentifier,
      "peerAvailable": peer.peerAvailable,
      "time": discoveredPeers[peer]
    });
  }
 
  this.emit('done', JSON.stringify({
    "name:": this.deviceName,
    "time": new Date() - this.startTime,
    "result": "OK",
    "peersList": results
  }));
}

module.exports = testNewFindPeers;
