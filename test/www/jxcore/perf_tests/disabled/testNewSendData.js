var net = require('net');
var inherits = require('util').inherits;
var randomstring = require('randomstring');
var ThaliEmitter = require('thali/thaliemitter');
var EventEmitter = require('events').EventEmitter;

function testSendData2(testConfig, deviceName, addressList) {

  this.testConfig = testConfig;
  this.deviceName = deviceName;

  this.addressList = addressList;

  this.peers = {};
  this.peerQueue = [];
  this.runningPeer = false;
  this.emitter = new ThaliEmitter();
  this.emitter.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, this.peerAvailabilityChanged);

  // Basic echo server..
  this.server = net.createServer(function(socket) {
    socket.pipe(socket);
  });
}

inherits(testSendData2, EventEmitter);

testSendData2.prototype.peerAvailabilityChanged = function(peers) {
  peers.forEach(function(peer) {
    console.log("%s %s", peer.peerIdentifer, peer.peerAvailable);
    if (peer.peerIdentifier in this.peers) {
      // Update to an existing peer
      this.peers[peerIdentifier].available = peer.peerAvailable;
    } else {
      // New peers
      this.peers[peer.peerIdentifier] = { 
        available : peer.peerAvailable,
        arrivalTime : new Date(),
        bytesToSend : this.testConfig.dataAmount
      };
      this.peerQueue.push(peer.peerIdentifier);
    }
  });
  this.pumpQueue();
}

testSendData2.prototype.pumpQueue = function() {

  if (this.peerQueue.length == 0 || this.runningPeer) {
    return;
  }

  var done = false;
  this.peerQueue.forEach(function(peerIdentifier) {
    var peer = this.peers[peerIdentifier];
    if (peerAvailable && peer.state == "waiting" && !done) {
      done = true;
      startPeer(peerIdentifier);
    }
  });
}

testSendData2.prototype.startPeer = function(peerIdentifier) {

  this.runningPeer = true;
  this.peers[peerIdentifier].state = "running";

  console.log("Running peer:%s", peerIdentifier);

  this.emitter.once(ThaliEmitter.events.CONNECTION_ERROR, function(peer) {
    console.log("Connection error: %s", peer.peerIdentifier);
  });

  var self = this;
  this.emitter.connect(peerIdentifier, function(err, port) {

    if (err) {
      this.peers[peerIdentifier].state = "waiting";
      return;
    }

    // Connect to remove server and send bytes..
    console.log("Link established to %s", peerIdentifer);
    var sock = net.connect(port, function() {
      console.log("Connected to %s", peerIdentifier);
      var toSend = randomstring.generate(self.peers[peerIdentifier].bytesToSend >> 1);
      var success = sock.write(toSend);
      console.log("Write result: %s", sucess);
    });

    var bytesReceived = 0;
    sock.on('data', function(data) {

      // Server's just echoing back what we send..
      self.peers[peerIdentifier].bytesToSend -= data.length;

      if (self.peer[peerIdentifier].bytesToSend == 0) {
        sock.end();
        self.emitter.disconnect(peerIdentifier, function() {
          console.log("Completed peer:%s", peerIdentifier);
          self.peers[peerIdentifer].state == "done";
          self.runningPeer = false;
          self.pumpQueue();
        });
      }
    });

    sock.on('error', function(reason) {
      console.log("Socket error: %s", reason);
    });
  });
}

testSendData2.prototype.start = function(serverPort) {

  this.server.listen(serverPort, "127.0.0.1");

  this.emitter.startBroadcasting(this.deviceName, serverPort, function(err) {
    if (err) {
      console.log("ERROR: Couldn't start broadcasting");
    }
  });
}

testSendData2.prototype.stop = function() {
  this.emitter.stopBroadcasting();
}
