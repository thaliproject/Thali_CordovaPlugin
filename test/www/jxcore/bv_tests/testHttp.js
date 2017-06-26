'use strict';

var http = require('http');
var tape = require('../lib/thaliTape');
var Promise = require('lie');
var EventEmitter = require('events').EventEmitter;
var ThaliMobileNativeWrapper =
  require('thali/NextGeneration/thaliMobileNativeWrapper');
var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var platform = require('thali/NextGeneration/utils/platform');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var thaliMobileNativeTestUtils = require('../lib/thaliMobileNativeTestUtils');

var httpServer = null;

var peerIdsToBeClosed = [];

var test = tape({
  setup: function (t) {
    httpServer = makeIntoCloseAllServer(http.createServer(), true);
    t.end();
  },
  teardown: function (t) {
    Promise.resolve()
      .then(function () {
        if (!platform.isAndroid) {
          return thaliMobileNativeTestUtils.killAllMultiConnectConnections(peerIdsToBeClosed);
        }
      })
      .catch(function (err) {
        t.fail(err);
      })
      .then(function () {
        (httpServer !== null ? httpServer.closeAllPromise() :
          Promise.resolve())
          .catch(function (err) {
            t.fail('httpServer had stop err ' + err);
          })
          .then(function () {
            peerIdsToBeClosed = [];
            t.end();
          });
      });
  }
});

function serverIsListening(server, port) {
  return new Promise(function (resolve, reject) {
    server.once('error', reject);
    server.listen(port, function () {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}

function makeRequest(hostname, port, method, path, requestData) {
  return new Promise(function (resolve, reject) {
    var options = {
      hostname: hostname,
      port: port,
      method: method,
      path: path
    };
    var request = http.request(options, function (response) {
      request.removeListener('error', reject);
      response.once('error', reject);

      var received = [];
      response.on('data', function (chunk) {
        received.push(chunk);
      });
      response.on('end', function () {
        response.removeListener('error', reject);
        var responseData = Buffer.concat(received);
        resolve(responseData);
      });
    });

    request.once('error', reject);
    if (requestData) {
      request.write(requestData);
    }
    request.end();
  });
}

function PeerFinder () {
  this.peers = {};
  this.eventEmitter = new EventEmitter();
  this._setUpEvents();
}

PeerFinder.prototype._nonTCPPeerAvailabilityHandler = function (peer) {
  var self = this;
  if (peer.peerAvailable) {
    self.peers[peer.peerIdentifier] = peer;
  } else {
    delete self.peers[peer.peerIdentifier];
  }
  self.eventEmitter.emit('peerschanged');
};

PeerFinder.prototype._setUpEvents = function () {
  var self = this;

  ThaliMobileNativeWrapper.emitter.on(
    'nonTCPPeerAvailabilityChangedEvent',
    self._nonTCPPeerAvailabilityHandler.bind(self)
  );
};

PeerFinder.prototype._getValues = function (obj) {
  return Object.keys(obj).map(function (k) { return obj[k]; });
};

PeerFinder.prototype.find = function (numberOfPeers) {
  var self = this;
  var keys = Object.keys(self.peers);
  if (keys.length >= numberOfPeers) {
    return Promise.resolve(self._getValues(self.peers));
  }
  return new Promise(function (resolve) {
    self.eventEmitter.on('peerschanged', function fn () {
      var keys = Object.keys(self.peers);
      if (keys.length >= numberOfPeers) {
        self.eventEmitter.removeListener('peerschanged', fn);
        resolve(self._getValues(self.peers));
      }
    });
  });
};

PeerFinder.prototype.cleanup = function () {
  var self = this;
  self.eventEmitter.removeAllListeners('peerschanged');
  ThaliMobileNativeWrapper.emitter.removeListener(
    'nonTCPPeerAvailabilityChangedEvent', self._nonTCPPeerAvailabilityHandler
  );
};

test('Single local http request', function (t) {
  httpServer.on('request', function (req, res) {
    var reply = req.method + ' ' + req.url;
    res.end(reply);
  });

  serverIsListening(httpServer, 0).then(function () {
    var port = httpServer.address().port;
    console.log('listening on %d', port);
    return makeRequest('127.0.0.1', port, 'GET', '/path');
  })
    .then(function (data) {
      t.equal(data.toString(), 'GET /path');
      return null;
    })
    .catch(t.fail)
    .then(function () {
      t.end();
    });
});

test('Single coordinated request ios native',
  function () {
    return platform.isAndroid ||
      global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI;
  },
  function (t) {
    var total = t.participants.length - 1;
    var counter = 0;

    httpServer.on('request', function (req, res) {
      var reply = req.method + ' ' + req.url;
      res.end(reply);
    });

    thaliMobileNativeTestUtils.executeZombieProofTestCoordinated(t, httpServer, function (connection, peer) {
      makeRequest('127.0.0.1', httpServer.address().port, 'GET', '/path')
        .then(function (response) {
          peerIdsToBeClosed.push(peer.peerIdentifier);
          t.equal(response.toString(), 'GET /path');

          ++counter === total ? t.end() : t.pass();
        })
        .catch(t.fail)
    });
  });

test('Multiple local http requests', function (t) {
  httpServer.on('request', function (req, res) {
    var reply = req.method + ' ' + req.url;
    res.end(reply);
  });

  serverIsListening(httpServer, 0).then(function () {
    var port = httpServer.address().port;
    console.log('listening on %d', port);
    return Promise.all([
      makeRequest('127.0.0.1', port, 'GET', '/path0'),
      makeRequest('127.0.0.1', port, 'GET', '/path1'),
      makeRequest('127.0.0.1', port, 'GET', '/path2'),
    ]);
  })
    .then(function (data) {
      t.equal(data[0].toString(), 'GET /path0');
      t.equal(data[1].toString(), 'GET /path1');
      t.equal(data[2].toString(), 'GET /path2');
      return null;
    })
    .catch(t.fail)
    .then(function () {
      t.end();
    });
});

test('Multiple coordinated request ios native',
  function () {
    return platform.isAndroid ||
    global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI;
  },
  function (t) {
    var firstReply = 'firstReply';
    var secondReply = 'secondReply';
    var thirdReply = 'thirdReply';
    var expectedReplies = [ firstReply, secondReply, thirdReply ];

    var reply;
    var total = t.participants.length - 1;
    var counter = 0;

    httpServer.on('request', function (req, res) {
      switch (req.url) {
        case '/path0':
          reply = firstReply;
          break;
        case '/path1':
          reply = secondReply;
          break;
        case '/path2':
          reply = thirdReply;
          break;
        default:
          t.end();
      }
      res.end(reply);
    });

    thaliMobileNativeTestUtils.executeZombieProofTestCoordinated(t, httpServer, function (connection, peer) {
      var localCounter = counter;

      makeRequest('127.0.0.1', httpServer.address().port, 'GET', '/path' + localCounter)
        .then(function (response) {

          peerIdsToBeClosed.push(peer.peerIdentifier);
          t.equal(response.toString(), expectedReplies[localCounter]);

          ++counter === total ? t.end() : t.pass();
        })
        .catch(t.fail);
    });
  });
