'use strict';

var http = require('http');
var tape = require('../lib/thaliTape');
var Promise = require('lie');
var EventEmitter = require('events').EventEmitter;
var ThaliMobileNativeWrapper =
  require('thali/NextGeneration/thaliMobileNativeWrapper');
var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var platform = require('thali/NextGeneration/utils/platform');
var randomString = require('randomstring');

var router = function () {};

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    ThaliMobileNativeWrapper.stop().then(function () {
      t.end();
    }).catch(t.end);
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

test('Single local http request', function (t) {
  var server = http.createServer(function (request, response) {
    var reply = request.method + ' ' + request.url;
    response.end(reply);
  });

  serverIsListening(server, 0).then(function () {
    var port = server.address().port;
    console.log('listening on %d', port);
    return makeRequest('127.0.0.1', port, 'GET', '/path');
  }).then(function (data) {
    t.equal(data.toString(), 'GET /path');
    return null;
  }).catch(t.fail).then(t.end);
});

test('Multiple local http requests', function (t) {
  var server = http.createServer(function (request, response) {
    var reply = request.method + ' ' + request.url;
    response.end(reply);
  });

  serverIsListening(server, 0).then( function () {
    var port = server.address().port;
    console.log('listening on %d', port);
    return Promise.all([
      makeRequest('127.0.0.1', port, 'GET', '/path0'),
      makeRequest('127.0.0.1', port, 'GET', '/path1'),
      makeRequest('127.0.0.1', port, 'GET', '/path2'),
    ]);
  }).then(function (data) {
    t.equal(data[0].toString(), 'GET /path0');
    t.equal(data[1].toString(), 'GET /path1');
    t.equal(data[2].toString(), 'GET /path2');
    return null;
  }).catch(t.fail).then(t.end);
});

function PeerFinder () {
  this.peers = {};
  this.eventEmitter = new EventEmitter();
  this._setUpEvents();
}

PeerFinder.prototype._nonTCPPeerAvailabilityHandler = function(peer) {
  var self = this;
  if (peer.peerAvailable) {
    self.peers[peer.peerIdentifier] = peer;
  } else {
    delete self.peers[peer.peerIdentifier];
  }
  self.eventEmitter.emit('peerschanged');
};

PeerFinder.prototype._setUpEvents = function() {
  var self = this;
  self._nonTCPPeerAvailabilityHandler = self._nonTCPPeerAvailabilityHandler
                                                                .bind(self);

  ThaliMobileNativeWrapper.emitter.on(
    'nonTCPPeerAvailabilityChangedEvent',
    self._nonTCPPeerAvailabilityHandler
  );
};

PeerFinder.prototype._getValues = function(obj) {
  return Object.keys(obj).map(function (k) { return obj[k]; });
};

PeerFinder.prototype.find = function(numberOfPeers) {
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

PeerFinder.prototype.cleanup = function() {
  var self = this;
  self.eventEmitter.removeAllListeners('peerschanged');
  ThaliMobileNativeWrapper.emitter.removeListener(
    'nonTCPPeerAvailabilityChangedEvent', self._nonTCPPeerAvailabilityHandler
  );
};

test('Single coordinated request ios native',
  function () {
    return platform.isAndroid ||
    global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI;
  },
  function (t) {
    var total = t.participants.length - 1;
    var peerFinder = new PeerFinder();

    var server = http.createServer(function (request, response) {
      var reply = request.method + ' ' + request.url;
      response.end(reply);
    });

    var listenNative = ThaliMobileNativeWrapper.start(router).then(function () {
      return ThaliMobileNativeWrapper.startListeningForAdvertisements();
    });
    var listenServer = serverIsListening(server, 0);

    var findPeers = peerFinder.find(total);

    Promise.all([ listenNative, listenServer ])
      .then(function (allResponses) {
        var server = allResponses[1];
        var port = server.address().port;
        console.log('listening on %d', port);
        return ThaliMobileNativeWrapper
          .startUpdateAdvertisingAndListening(port);
      })
      .then(function () {
        return findPeers;
      })
      .then(function (peers) {
        return Promise.all(peers.map(function (peer) {
          return ThaliMobileNativeWrapper._multiConnect(peer.peerIdentifier);
        }));
      })
      .then(function (ports) {
        return Promise.all(ports.map(function (port) {
          return makeRequest('127.0.0.1', port, 'GET', '/path');
        }));
      })
      .then(function (responses) {
        responses.forEach(function (r) {
          t.equal(r.toString(), 'GET /path');
        });
      })
      .catch(t.fail)
      .then(function () {
        peerFinder.cleanup();
        t.end();
      });
  });

test('Multiple coordinated request ios native',
  function () {
    return platform.isAndroid ||
    global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI;
  },
  function (t) {
    var firstReply = randomString.generate(2000);
    var secondReply = randomString.generate(30);
    var thirdReply = randomString.generate(3000);
    var reply;
    var total = t.participants.length - 1;
    var peerFinder = new PeerFinder();

    var server = http.createServer(function (request, response) {
      switch (request.url) {
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
      response.end(reply);
    });

    var listenNative = ThaliMobileNativeWrapper.start(router).then(function () {
      return ThaliMobileNativeWrapper.startListeningForAdvertisements();
    });
    var listenServer = serverIsListening(server, 0);

    var findPeers = peerFinder.find(total);

    Promise.all([ listenNative, listenServer ])
      .then(function (allResponses) {
        var server = allResponses[1];
        var port = server.address().port;
        console.log('listening on %d', port);
        return ThaliMobileNativeWrapper
          .startUpdateAdvertisingAndListening(port);
      })
      .then(function () {
        return findPeers;
      })
      .then(function (peers) {
        return Promise.all(peers.map(function (peer) {
          return ThaliMobileNativeWrapper._multiConnect(peer.peerIdentifier);
        }));
      })
      .then(function (ports) {
        return Promise.all(ports.map(function (port) {
          return Promise.all([
            makeRequest('127.0.0.1', port, 'GET', '/path0'),
            makeRequest('127.0.0.1', port, 'GET', '/path1'),
            makeRequest('127.0.0.1', port, 'GET', '/path2'),
          ]);
        }));
      })
      .then(function (responses) {
        responses.forEach(function (r) {
          t.equal(r[0].toString(), firstReply);
          t.equal(r[1].toString(), secondReply);
          t.equal(r[2].toString(), thirdReply);
        });
      })
      .catch(t.fail)
      .then(function () {
        peerFinder.cleanup();
        t.end();
      });
  });
