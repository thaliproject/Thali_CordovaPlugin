var ThaliEmitter = require('thali/thaliemitter');

function testNewSendData(testData, name, peerCount, bluetoothAddresses) {
  this.deviceName = name;
  this.testData = testData;
  this.peerCount = peerCount;
  this.bluetoothAddresses = bluetoothAddresses;
}

testNewSendData.prototype.start = function() {

  var self = this;

  this.startTime = new Date();
  this.emitter = new ThaliEmitter();

  var discoveredPeers = {};
  this.emitter.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, function(peers) {
    var now = new Date();
    peers.forEach(function(peer) {
      if (!(peer.peerIdentifier in discoveredPeers) && peer.peerAvailable) {
        discoveredPeers[peer.peerIdentifier] = { 
          discovered: now - startTime,
          sendComplete: false
        };
      }
    }
  });

  this.emitter.startBroadcasting(this.deviceName, 4242, function (err) {
    if (err) {
      self.reportResults([], err);
      self.stop();
    }
  );
}

testNewSendData.prototype.stop = function() {
  this.emitter.stopBroadcasting(function(err) {
    console.log(err);
    this.emitter = null;
  };
}


