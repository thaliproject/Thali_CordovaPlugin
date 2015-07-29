var test = require('tape');
var net = require('net');
var randomstring = require('randomstring');
var ThaliEmitter = require('../thali/thaliemitter');

test('ThaliEmitter can call startBroadcasting and endBroadcasting without error', function (t) {
  var e = new ThaliEmitter();

  e.startBroadcasting((+ new Date()).toString(), 5001, function (err1) {
    t.notOk(err1);

    e.stopBroadcasting(function (err2) {
      t.notOk(err2);
      t.end();
    });
  });
});

test('ThaliEmitter calls startBroadcasting twice with error', function (t) {
  var e = new ThaliEmitter();

  e.startBroadcasting((+ new Date()).toString(), 5001, function (err1) {
    t.notOk(err1);

    e.startBroadcasting((+ new Date()).toString(), 5001, function (err2) {

      t.assert(!!err2, err2.message);

      e.stopBroadcasting(function (err3) {
        t.notOk(err3);
        t.end();
      });
    });
  });
});

test('ThaliEmitter throws on connection to bad peer', function (t) {
  var e = new ThaliEmitter();

  e.startBroadcasting((+ new Date()).toString(), 5001, function (err1) {
    t.notOk(err1);

    e.connect('foobar', function (err2, port) {
      t.assert(!!err2, err2.message);

      e.stopBroadcasting(function (err3) {
        t.notOk(err3);
        t.end();
      });
    });
  });
});

test('ThaliEmitter throws on disconnect to bad peer', function (t) {
  var e = new ThaliEmitter();

  e.startBroadcasting((+ new Date()).toString(), 5001, function (err1) {
    t.notOk(err1);

    e.disconnect('foobar', function (err2, port) {
      t.assert(err2, err2.message);

      e.stopBroadcasting(function (err3) {
        t.notOk(err3);
        t.end();
      });
    });
  });
});

test('ThaliEmitter can discover and connect to peers', function (t) {
  var e = new ThaliEmitter();

  e.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, function (peers) {
    peers.forEach(function (peer) {

      // This will only pick the first available peer
      if (peer.peerAvailable) {

        function connectToPeer(attempts) {
          if (attempts === 0) {
            t.fail('Connecting failed');
            t.end();
            return;
          }

          e.connect(peer.peerIdentifier, function (err2, port) {
            if (err2) {
              setTimeout(function () { connectToPeer(attempts - 1); }, 1000);
            }

            t.notOk(err2, 'Connect should pass ' + (err2 ? err2.message : ''));
            t.ok(port > 0 && port <= 65536);

            e.disconnect(peer.peerIdentifier, function (err3) {
              t.notOk(err3, 'Disconnect should pass ' + (err3 ? err3.message : ''));

              e.stopBroadcasting(function (err4) {
                t.notOk(err4);
                t.end();
              });
            });
          });
        }

        connectToPeer(10);
      }
    });
  });

  e.startBroadcasting((+ new Date()).toString(), 5001, function (err1) {
    t.notOk(err1);
  });
});

test('ThaliEmitter can discover and connect to peers and then fail on double connect', function (t) {
  var e = new ThaliEmitter();

  e.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, function (peers) {
    peers.forEach(function (peer) {

      // This will only pick the first available peer
      if (peer.peerAvailable) {
        function connectToPeer(attempts) {
          if (attempts === 0) {
            t.fail('Connecting failed');
            t.end();
            return;
          }

          e.connect(peer.peerIdentifier, function (err2, port) {
            if (err2) {
              setTimeout(function () { connectToPeer(attempts - 1); }, 1000);
            }

            t.notOk(err2, 'Connect should pass ' + (err2 ? err2.message : ''));
            t.ok(port > 0 && port <= 65536);

            e.connect(peer.peerIdentifier, function(err3, port) {
              t.ok(err3, 'Error was ' + err3);
              t.equal(port, undefined);

              e.disconnect(peer.peerIdentifier, function (err4) {
                t.notOk(err4, 'Disconnect should pass ' + (err4 ? err4.message : ''));

                e.stopBroadcasting(function (err4) {
                  t.notOk(err4);
                  t.end();
                });
              });
            });
          });
        }
        connectToPeer(10);
      }
    });
  });

  e.startBroadcasting((+ new Date()).toString(), 5001, function (err1) {
    t.notOk(err1);
  });
});

test('ThaliEmitter can discover and connect to peers and then fail on double disconnect', function (t) {
  var e = new ThaliEmitter();

  e.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, function (peers) {
    peers.forEach(function (peer) {

      // This will only pick the first available peer
      if (peer.peerAvailable) {
        function connectToPeer(attempts) {
          if (attempts === 0) {
            t.fail('Connecting failed');
            t.end();
            return;
          }

          e.connect(peer.peerIdentifier, function (err2, port) {
            if (err2) {
              setTimeout(function () { connectToPeer(attempts - 1); }, 1000);
            }

            t.notOk(err2, 'Connect should pass ' + (err2 ? err2.message : ''));
            t.ok(port > 0 && port <= 65536);

            e.disconnect(peer.peerIdentifier, function(err3) {
              t.notOk(err3, 'Disconnect should pass ' + (err3 ? err3.message : ''));

              e.disconnect(peer.peerIdentifier, function (err4) {
                t.ok(err4, 'Error was ' + err4);

                e.stopBroadcasting(function (err5) {
                  t.notOk(err5);
                  t.end();
                });
              });
            });
          });
        }
        connectToPeer(10);
      }
    });
  });

  e.startBroadcasting((+ new Date()).toString(), 5001, function (err1) {
    t.notOk(err1);
  });
});

test('ThaliEmitter can connect and send data', function (t) {
  var e = new ThaliEmitter();

  var len = 200;
  var testMessage = randomstring.generate(len);

  e.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, function (peers) {
    peers.forEach(function (peer) {

      // This will only pick the first available peer
      if (peer.peerAvailable) {

        function connectToPeer(attempts) {
          if (attempts === 0) {
            t.fail('Connecting failed');
            t.end();
            return;
          }

          e.connect(peer.peerIdentifier, function (err2, port) {
            if (err2) {
              setTimeout(function () { connectToPeer(attempts - 1); }, 1000);
            }

            t.notOk(err2, 'Connect should pass ' + (err2 ? err2.message : ''));

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

                e.disconnect(peer.peerIdentifier, function (err3) {
                  t.notOk(err3, 'Disconnect should pass ' + (err3 ? err3.message : ''));

                  e.stopBroadcasting(function (err4) {
                    t.notOk(err4, 'stop broadcasting does not fail');
                    t.end();
                  });
                });
              }
            });
          });
        }

        connectToPeer(10);
      }
    });
  });

  e.startBroadcasting((+ new Date()).toString(), 5001, function (err1) {
    t.notOk(err1, 'startBroadcasting does not throw');
  });
});
