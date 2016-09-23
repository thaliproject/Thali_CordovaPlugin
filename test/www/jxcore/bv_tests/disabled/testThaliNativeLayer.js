'use strict';

if (!jxcore.utils.OSInfo().isMobile) {
  return;
}

var net = require('net');
var randomstring = require('randomstring');
var ThaliEmitter = require('thali/thaliemitter');
var tape = require('../lib/thaliTape');

function newPeerIdentifier() {
  return (+ new Date()).toString() + "." + process.pid;
}

var  emitterToShutDown = null;

var test = tape({
  setup: function(t) {
    t.end();
  },
  teardown: function(t) {
    if (emitterToShutDown != null){
      console.log("calling stopBroadcasting");
      emitterToShutDown.stopBroadcasting(function (err4) {
        console.log("stopBroadcasting returned " + err4);
        t.end();
      });
      emitterToShutDown = null;
    } else {
      t.end();
    }
  }
});

test('ThaliEmitter can call repeatedly startBroadcasting and stopBroadcasting without error', function (t) {
  var e = new ThaliEmitter();

  function repeatCalls(count) {
    if (count == 0) {
      t.end();
      return;
    }

    e.startBroadcasting(newPeerIdentifier(), 5001, function (err1) {
      t.notOk(err1, 'Should be able to call startBroadcasting without error');
      e.stopBroadcasting(function (err2) {
        t.notOk(err2, 'Should be able to call stopBroadcasting without error');
        repeatCalls(count - 1);
      });
    });
  }

  repeatCalls(10);
});

test('ThaliEmitter calls startBroadcasting twice with error', function (t) {
  var e = new ThaliEmitter();

  e.startBroadcasting(newPeerIdentifier(), 5001, function (err1) {
    t.notOk(err1, 'Should be able to call startBroadcasting without error');

    e.startBroadcasting(newPeerIdentifier(), 5001, function (err2) {

      t.assert(!!err2, 'Cannot call startBroadcasting twice');

      e.stopBroadcasting(function (err3) {
        t.notOk(err3, 'Should be able to call stopBroadcasting without error');
        t.end();
      });
    });
  });
});

test('ThaliEmitter throws on connection to bad peer', function (t) {
  var e = new ThaliEmitter();

  e.startBroadcasting(newPeerIdentifier(), 5001, function (err1) {
    t.notOk(err1, 'Should be able to call startBroadcasting without error');

    e.connect('foobar', function (err2, port) {
      t.assert(!!err2, 'Should not connect to a bad peer');

      e.stopBroadcasting(function (err3) {
        t.notOk(err3, 'Should be able to call stopBroadcasting without error');
        t.end();
      });
    });
  });
});

test('ThaliEmitter throws on disconnect to bad peer', function (t) {
  var e = new ThaliEmitter();

  e.startBroadcasting(newPeerIdentifier(), 5001, function (err1) {
    t.notOk(err1, 'Should be able to call startBroadcasting without error');

    e.disconnect('foobar', function (err2, port) {
      t.assert(!!err2, 'Disconnect should fail to a non-existant peer ');

      e.stopBroadcasting(function (err3) {
        t.notOk(err3, 'Should be able to call stopBroadcasting without error');
        t.end();
      });
    });
  });
});

function connectWithRetryTestAndDisconnect(t, testFunction, port) {
  var e = new ThaliEmitter();

  var _done = false;

  e.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, function (peers) {

    peers.forEach(function (peer) {

      if (peer.peerAvailable) {
        var connectToPeer = function(attempts) {

          if (!_done) {
            if (attempts === 0) {
              t.fail('Connecting failed');
              return t.end();
            }

            e.connect(peer.peerIdentifier, function (err2, port) {

              if (err2) {
                if (err2.message.indexOf("unreachable") != -1) {
                  // Peer has become unreachable no point retrying
                  return;
                } else {
                  // Retry
                  return setTimeout(function () { connectToPeer(attempts - 1); }, 1000);
                }
              }

              t.notOk(err2, 'Should be able to connect without error');
              t.ok(port > 0 && port <= 65536, 'Port should be within range');

              testFunction(t, e, peer, port, function() {
                console.log("setting stopBroadcasting callback and ending test.");
                emitterToShutDown = e;
                _done = true;
                t.end();
              });
            });
          };
        }

        connectToPeer(10);
      }
    });
  });

  e.startBroadcasting(newPeerIdentifier(), (port || 5001), function (err1) {
    t.notOk(err1, 'Should be able to call startBroadcasting without error');
  });
}

// Skip the rest of the tests in this file on Android since they aren't passing.
if (typeof jxcore !== 'undefined' && jxcore.utils.OSInfo().isAndroid) {
  return;
}

test('ThaliEmitter can discover and connect to peers', function (t) {
  connectWithRetryTestAndDisconnect(t, function(t, e, peer, port, cb) {
    e.disconnect(peer.peerIdentifier, function (err3) {
      t.notOk(err3, 'Should be able to disconnect without error');
      cb();
    });
  });
});

test('ThaliEmitter can discover and connect to peers and then fail on double connect', function (t) {
  connectWithRetryTestAndDisconnect(t, function(t, e, peer, port, cb) {
    e.connect(peer.peerIdentifier, function(err3, port) {
      t.ok(err3, 'Should fail on double connect');
      e.disconnect(peer.peerIdentifier, function (err3) {
        t.notOk(err3, 'Should be able to disconnect without error');
        cb();
      });
    });
  });
});

test('ThaliEmitter can discover and connect to peers and then fail on double disconnect', function (t) {
  connectWithRetryTestAndDisconnect(t, function (t, e, peer, port, cb) {
    e.disconnect(peer.peerIdentifier, function (err3) {
      t.notOk(err3, 'Should be able to disconnect without error');

      e.disconnect(peer.peerIdentifier, function (err4) {
        t.ok(err4, 'Disconnect should fail ');
        cb();
      });
    });
  });
});

test('ThaliEmitter can connect and send data', function (t) {

  var server = net.createServer(function(s) {
    s.pipe(s);
  });

  server.listen(0, function() {
    var serverPort = server.address().port;
    console.log('echo server started on port: ' + serverPort);

    var len = (128 * 1024);
    var testMessage = randomstring.generate(len);
    connectWithRetryTestAndDisconnect(t, function(t, e, peer, port, cb) {
      var clientSocket = net.createConnection( { port: port }, function () {
        clientSocket.write(testMessage);
      });

      clientSocket.setTimeout(120000);
      clientSocket.setKeepAlive(true);

      var testData = '';

      clientSocket.on('data', function (data) {
        testData += data;
        console.log("data in " + testData.length);

        if (testData.length === len) {
          t.equal(testData, testMessage, 'the test messages should be equal');

          e.disconnect(peer.peerIdentifier, function (err3) {
            t.notOk(err3, 'Should be able to disconnect without error');
            cb();
          });
        }
      });
    }, serverPort);
  });
});

test('ThaliEmitter handles socket disconnect correctly', function (t) {

  var done = false;
  var emitter = new ThaliEmitter();

  var server = net.createServer(function(s) {
    s.on('end', function () {
      // A hackish workaround to make the test pass with the mock
      // who wouldn't otherwise be aware of the connection errors.
      if (Mobile.iAmAMock === true) {
        Mobile.TriggerConnectionError();
      }
    });
    s.pipe(s);
  });

  server.listen(0, function() {
    var serverPort = server.address().port;
    console.log('echo server started on port: ' + serverPort);

    var connectWithRetry = function(peerIdentifier, cb) {

      var connectToPeer = function(attempts) {

        if (attempts === 0) {
          cb("too many attempts");
          return;
        }

        emitter.connect(peerIdentifier, function (connectError, port) {
          if (connectError) {
            if (connectError.message.indexOf("unreachable") != -1) {
              return;
            } else {
              return setTimeout(function () { connectToPeer(attempts - 1); }, 1000);
            }
          }

          t.notOk(connectError, 'Should be able to connect without error');
          t.ok(port > 0 && port <= 65536, 'Port should be within range');
          cb(null, port);
        });
      }

      connectToPeer(10);
    }

    var sendData = function(port, cb) {

      var len = 2048;
      var testMessage = randomstring.generate(len);
      var clientSocket = net.createConnection( { port: port }, function () {
        clientSocket.write(testMessage);
      });

      clientSocket.setTimeout(120000);
      clientSocket.setKeepAlive(true);

      var testData = '';

      clientSocket.on('data', function (data) {
        testData += data;

        if (testData.length === len) {
          t.equal(testData, testMessage, 'the test messages should be equal');
          clientSocket.end();
          cb(true);
        }
      });
    }

    emitter.startBroadcasting(newPeerIdentifier(), serverPort, function (err) {

      t.notOk(err, 'Should be able to call startBroadcasting without error');

      emitter.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, function (peers) {

        console.log(JSON.stringify(peers));

        peers.forEach(function (peer) {

          if (peer.peerAvailable) {

            connectWithRetry(peer.peerIdentifier, function(err1, port) {

              t.assert(err1 == null, "First connect should succeed");

              if (err1) {
                t.end();
                return;
              }

              sendData(port, function(success) {
                t.assert(success == true, "First send should succeed");
              });

              emitter.on(ThaliEmitter.events.CONNECTION_ERROR, function(peer) {

                if (done)
                  return;

                connectWithRetry(peer.peerIdentifier, function(err2, port) {

                  t.assert(err2 == null, "Second connect should succeed");

                  if (err2) {
                    t.end();
                    return;
                  }

                  sendData(port, function(success) {
                    done = true;
                    t.assert(success == true, "Second send should succeed");
                    emitterToShutDown = emitter;
                    t.end();
                  });
                })
              });
            });
          }
        });
      });
    });
  });
});
