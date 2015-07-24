var test = require('tape');
var net = require('net');
var randomstring = require('randomstring');
var ThaliEmitter = require('../thali/thaliemitter');

test('ThaliEmitter can call startBroadcasting and endBroadcasting without error', function (t) {
  var e = new ThaliEmitter();

  console.log('about to call startBroadcasting');
  e.startBroadcasting((+ new Date()).toString(), 5000, function (err1) {
    t.notOk(err1);

    console.log('about to call stop broadcasting');
    e.stopBroadcasting(function (err2) {
      t.notOk(err2);
      t.end();
    });
  });
});

test('ThaliEmitter can call startBroadcasting and endBroadcasting without error', function (t) {
  var e = new ThaliEmitter();

  e.stopBroadcasting(function (err) {
    t.assert(err, err.message);
    t.end();
  });

});

test('ThaliEmitter calls startBroadcasting twice with error', function (t) {
  var e = new ThaliEmitter();

  e.startBroadcasting((+ new Date()).toString(), 5000, function (err1) {
    t.notOk(err1);

    e.startBroadcasting((+ new Date()).toString(), 5000, function (err2) {

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

  e.startBroadcasting((+ new Date()).toString(), 5000, function (err1) {
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

  e.startBroadcasting((+ new Date()).toString(), 5000, function (err1) {
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
        e.connect(peer.peerIdentifier, function (err2, port) {
          t.notOk(err2);
          t.ok(port > 0 && port <= 65536);

          e.disconnect(peer.peerIdentifier, function (err3) {
            t.notOk(err3);

            e.stopBroadcasting(function (err4) {
              t.notOk(err4);
              t.end();
            });
          });
        });
      }
    });
  });

  e.startBroadcasting((+ new Date()).toString(), 5000, function (err1) {
    t.notOk(err1);
  });
});

test('ThaliEmitter can discover and connect to peers and then fail on double connect', function (t) {
  var e = new ThaliEmitter();

  e.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, function (peers) {
    peers.forEach(function (peer) {

      // This will only pick the first available peer
      if (peer.peerAvailable) {
        e.connect(peer.peerIdentifier, function (err2, port) {
          t.notOk(err2);
          t.ok(port > 0 && port <= 65536);

          e.connect(peer.peerIdentifier, function(err3, port) {
            t.ok(err3, 'Error was ' + err3);
            t.equal(port, -1);

            e.disconnect(peer.peerIdentifier, function (err3) {
              t.notOk(err3);

              e.stopBroadcasting(function (err4) {
                t.notOk(err4);
                t.end();
              });
            });
          });
        });
      }
    });
  });

  e.startBroadcasting((+ new Date()).toString(), 5000, function (err1) {
    t.notOk(err1);
  });
});

test('ThaliEmitter can discover and connect to peers and then fail on double disconnect', function (t) {
  var e = new ThaliEmitter();

  e.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, function (peers) {
    peers.forEach(function (peer) {

      // This will only pick the first available peer
      if (peer.peerAvailable) {
        e.connect(peer.peerIdentifier, function (err2, port) {
          t.notOk(err2);
          t.ok(port > 0 && port <= 65536);

          e.disconnect(peer.peerIdentifier, function(err3) {
            t.notOk(err3);

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
    });
  });

  e.startBroadcasting((+ new Date()).toString(), 5000, function (err1) {
    t.notOk(err1);
  });
});

test('ThaliEmitter can connect and send data', function (t) {
  var e = new ThaliEmitter();

  var testMessage = randomstring.generate(200);

  e.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, function (peers) {
    peers.forEach(function (peer) {

      // This will only pick the first available peer
      if (peer.peerAvailable) {
        e.connect(peer.peerIdentifier, function (err2, port) {
          t.notOk(err2);

          var server = net.createServer(function (socket) {
            socket.pipe(socket);
          });

          server.listen(port);

          var clientSocket = net.createConnection( { port: port }, function () {
            clientSocket.end(testMessage);
          });

          clientSocket.setTimeout(120000);
          clientSocket.setKeepAlive(true);

          var testData = '';

          clientSocket.on('data', function (data) {
            testData += data;
          });

          clientSocket.on('end', function () {
            t.equal(testData, testMessage);

            // Ensure tidying up
            server.close();

            e.disconnect(peer.peerIdentifier, function (err3) {
              t.notOk(err3);

              e.stopBroadcasting(function (err4) {
                t.notOk(err4);
                t.end();
              });
            });
          });
        });
      }
    });
  });

  e.startBroadcasting((+ new Date()).toString(), 5000, function (err1) {
    t.notOk(err1);
  });
});
