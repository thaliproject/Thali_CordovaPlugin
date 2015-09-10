'use strict';


var test = require('tape');
var net = require('net');
var randomstring = require('randomstring');
var ThaliEmitter = require('thali/thaliemitter');

var events = require('events');

var ThaliNativeLayerTCPServer = require('./ThaliNativeLayerTCPServer');

function testThaliNativeLayer(jsonData,name) {
  var self = this;
  this.name = name;
  this.commandData = JSON.parse(jsonData);
  this.startTime = new Date();
  this.endTime = new Date();
  this.endReason = "";
  this.testResults = [];

  console.log('testThaliNativeLayer is created');

  test.createStream({ objectMode: true }).on('data', function (row) {
    console.log(JSON.stringify(row));
    self.testResults.push(row);
  });

}

testThaliNativeLayer.prototype = new events.EventEmitter;

testThaliNativeLayer.prototype.start = function() {
  var self = this;
  this.testServer = new ThaliNativeLayerTCPServer();
  this.startTime = new Date();

  if (!jxcore.utils.OSInfo().isMobile) {
    this.endReason = "Not mobile environment";
    this.weAreDoneNow();
    return;
  }

  if (this.commandData.timeout) {
    this.timerId = setTimeout(function () {
      console.log('timeout now');
      if (!self.doneAlready) {
        console.log('TIMEOUT');
        self.endReason = "TIMEOUT";
        self.emit('debug', "*** TIMEOUT ***");
        self.stop();
      }
    }, this.commandData.timeout);
  }

  console.log('we are sterting, serverport is ' + self.testServer.getServerPort());

  this.currentTest = 0;
  this.doNextTest();
}

testThaliNativeLayer.prototype.stop = function() {
  console.log('testThaliNativeLayer::stop');
  this.weAreDoneNow();
  this.testServer.stopServer();
}

testThaliNativeLayer.prototype.doNextTest = function() {

  if(this.doneAlready) {
    return;
  }

  this.currentTest++;
  console.log('do next test : ' + this.currentTest);
  switch(this.currentTest) {
    case 1:
      this.doTest1();
      break;
    case 2:
      this.doTest2();
      break;
    case 3:
      this.doTest3();
      break;
    case 4:
      this.doTest4();
      break;
    case 5:
      this.doTest5();
      break;
    case 6:
      this.doTest6();
      break;
    case 7:
      this.doTest7();
      break;
    case 8:
      this.doTest8();
      break;
    default:
      this.endReason = "OK";
      this.weAreDoneNow();
      break;
  }
}

testThaliNativeLayer.prototype.doTest1 = function() {
  var self = this;
  this.emit('debug', "1. start/stopBroadcasting repeatedly --");
  test('ThaliEmitter can call repeatedly startBroadcasting and stopBroadcasting without error', function (t) {
    var e = new ThaliEmitter();

    function repeatCalls(count) {
      if (count == 0) {
        t.end();
        self.doNextTest();
        return;
      }

      e.startBroadcasting(self.name, self.testServer.getServerPort(), function (err1) {
        t.notOk(err1, 'Should be able to call startBroadcasting without error');
        e.stopBroadcasting(function (err2) {
          t.notOk(err2, 'Should be able to call stopBroadcasting without error');
          repeatCalls(count - 1);
        });
      });
    }

    repeatCalls(10);
  });
}

testThaliNativeLayer.prototype.doTest2 = function() {
  var self = this;
  this.emit('debug', "2. startBroadcasting twice --");

  test('ThaliEmitter calls startBroadcasting twice with error', function (t) {
    var e = new ThaliEmitter();

    e.startBroadcasting(self.name, self.testServer.getServerPort(), function (err1) {
      t.notOk(err1, 'Should be able to call startBroadcasting without error');

      e.startBroadcasting(self.name, self.testServer.getServerPort(), function (err2) {

        t.assert(!!err2, 'Cannot call startBroadcasting twice');

        e.stopBroadcasting(function (err3) {
          t.notOk(err3, 'Should be able to call stopBroadcasting without error');
          t.end();
          self.doNextTest();
        });
      });
    });
  });
}

testThaliNativeLayer.prototype.doTest3 = function() {
  var self = this;
  this.emit('debug', "3. connection to bad peer --");

  test('ThaliEmitter throws on connection to bad peer', function (t) {
    var e = new ThaliEmitter();

    e.startBroadcasting(self.name, self.testServer.getServerPort(), function (err1) {
      t.notOk(err1, 'Should be able to call startBroadcasting without error');

      e.connect('foobar', function (err2, port) {
        t.assert(!!err2, 'Should not connect to a bad peer');

        e.stopBroadcasting(function (err3) {
          t.notOk(err3, 'Should be able to call stopBroadcasting without error');
          t.end();
          self.doNextTest();
        });
      });
    });
  });
}

testThaliNativeLayer.prototype.doTest4 = function() {
  var self = this;
  this.emit('debug', "4. disconnect to bad peer --");

  test('ThaliEmitter throws on disconnect to bad peer', function (t) {
    var e = new ThaliEmitter();

    e.startBroadcasting(self.name, self.testServer.getServerPort(), function (err1) {
      t.notOk(err1, 'Should be able to call startBroadcasting without error');

      e.disconnect('foobar', function (err2, port) {
        t.assert(!!err2, 'Disconnect should fail to a non-existant peer ');

        e.stopBroadcasting(function (err3) {
          t.notOk(err3, 'Should be able to call stopBroadcasting without error');
          t.end();
          self.doNextTest();
        });
      });
    });
  });
}

testThaliNativeLayer.prototype.connectWithRetryTestAndDisconnect = function(t, testFunction) {
  var self = this;
  var e = new ThaliEmitter();
  var _done = false;

  e.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, function (peers) {

    peers.forEach(function (peer) {

      if (peer.peerAvailable) {
        var connectToPeer = function (attempts) {

          if (!_done) {
            if (attempts === 0) {
              t.fail('Connecting failed');
              t.end();
              self.doNextTest();
              return;
            }

            e.connect(peer.peerIdentifier, function (err2, port) {

              if (err2) {
                if (err2.message.indexOf("unreachable") != -1) {
                  // Peer has become unreachable no point retrying
                  return;
                } else {
                  // Retry
                  return setTimeout(function () {
                    connectToPeer(attempts - 1);
                  }, 1000);
                }
              }

              t.notOk(err2, 'Should be able to connect without error');
              t.ok(port > 0 && port <= 65536, 'Port should be within range');

              testFunction(t, e, peer, port, function () {
                e.stopBroadcasting(function (err4) {
                  t.notOk(err4, 'Should be able to call stopBroadcasting without error');
                  _done = true;
                  t.end();
                  self.doNextTest();
                });
              });
            });
          }
          ;
        }

        connectToPeer(10);
      }
    });
  });

  e.startBroadcasting(self.name, self.testServer.getServerPort(), function (err1) {
    t.notOk(err1, 'Should be able to call startBroadcasting without error');
  });
}

// todo, we currently get stuck in here, since the doNextTest is never called, gotta figure where to add those
testThaliNativeLayer.prototype.doTest5 = function() {
  var self = this;
  this.emit('debug', "5. discover and connect to peers --");

  test('ThaliEmitter can discover and connect to peers', function (t) {
    self.connectWithRetryTestAndDisconnect(t, function (t, e, peer, port, cb) {
      e.disconnect(peer.peerIdentifier, function (err3) {
        t.notOk(err3, 'Should be able to disconnect without error');
        cb();
      });
    });
  });

}

testThaliNativeLayer.prototype.doTest6 = function() {
  var self = this;
  this.emit('debug', "6. fail on double connect --");

  test('ThaliEmitter can discover and connect to peers and then fail on double connect', function (t) {
    self.connectWithRetryTestAndDisconnect(t, function (t, e, peer, port, cb) {
      e.connect(peer.peerIdentifier, function (err3, port) {
        t.ok(err3, 'Should fail on double connect');
        e.disconnect(peer.peerIdentifier, function (err3) {
          t.notOk(err3, 'Should be able to disconnect without error');
          cb();
        });
      });
    });
  });
}

testThaliNativeLayer.prototype.doTest7 = function() {
  var self = this;
  this.emit('debug', "7. fail on double disconnect --");

  test('ThaliEmitter can discover and connect to peers and then fail on double disconnect', function (t) {
    self.connectWithRetryTestAndDisconnect(t, function (t, e, peer, port, cb) {
      e.disconnect(peer.peerIdentifier, function (err3) {
        t.notOk(err3, 'Should be able to disconnect without error');

        e.disconnect(peer.peerIdentifier, function (err4) {
          t.ok(err4, 'Disconnect should fail ');
          cb();
        });
      });
    });
  });
}

testThaliNativeLayer.prototype.doTest8 = function() {
  var self = this;
  this.emit('debug', "8. connect and send data --");

  test('ThaliEmitter can connect and send data', function (t) {
    var len = 1025;
    var testMessage = randomstring.generate(len);
    self.connectWithRetryTestAndDisconnect(t, function (t, e, peer, port, cb) {
      var clientSocket = net.createConnection({port: port}, function () {
        clientSocket.write(testMessage);
      });

      clientSocket.setTimeout(120000);
      clientSocket.setKeepAlive(true);

      var testData = '';

      clientSocket.on('data', function (data) {
        testData += data;

        if (testData.length === len) {
          t.equal(testData, testMessage, 'the test messages should be equal');

          e.disconnect(peer.peerIdentifier, function (err3) {
            t.notOk(err3, 'Should be able to disconnect without error');
            cb();
          });
        }
      });
    });
  });
}

testThaliNativeLayer.prototype.weAreDoneNow = function() {

  if(this.doneAlready){
    return;
  }

  this.doneAlready = true;

  if (this.timerId != null) {
    clearTimeout(this.timerId);
    this.timerId = null;
  }

  console.log('weAreDoneNow');
  this.endTime = new Date();

  this.emit('debug', "---- finished : testThaliNativeLayer -- ");
  var responseTime = this.endTime - this.startTime;
  this.emit('done', JSON.stringify({"name:": this.name,"time": responseTime,"result": this.endReason,"testResult":this.testResults}));
}

module.exports = testThaliNativeLayer;