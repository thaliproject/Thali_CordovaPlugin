'use strict';

var http = require('http');
var tape = require('../lib/thaliTape');
var Promise = require('lie');
var EventEmitter = require('events').EventEmitter;
var ThaliMobileNativeWrapper =
  require('thali/NextGeneration/thaliMobileNativeWrapper');
var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var platform = require('thali/NextGeneration/utils/platform');

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

var peerFinder = function () {
  var peers = {};
  var eventEmitter = new EventEmitter();
  var handler = function (peer) {
    if (peer.peerAvailable) {
      peers[peer.peerIdentifier] = peer;
    } else {
      delete peers[peer.peerIdentifier];
    }
    eventEmitter.emit('peerschanged');
  };

  function values(obj) {
    return Object.keys(obj).map(function (k) { return obj[k]; });
  }

  function find(numberOfPeers) {
    var keys = Object.keys(peers);
    if (keys.length >= numberOfPeers) {
      return Promise.resolve(values(peers));
    }
    return new Promise(function (resolve) {
      eventEmitter.on('peerschanged', function fn () {
        var keys = Object.keys(peers);
        if (keys.length >= numberOfPeers) {
          eventEmitter.removeListener('peerschanged', fn);
          resolve(values(peers));
        }
      });
    });
  }

  ThaliMobileNativeWrapper.emitter.on(
    'nonTCPPeerAvailabilityChangedEvent', handler
  );
  find.cleanup = function () {
    eventEmitter.removeAllListeners('peerschanged');
    ThaliMobileNativeWrapper.emitter.removeListener(
      'nonTCPPeerAvailabilityChangedEvent', handler
    );
  };

  return find;
};

test('Single coordinated request ios native',
  function () {
    return platform.isAndroid ||
    global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI;
  },
  function (t) {
    var total = t.participants.length - 1;
    var find = peerFinder();

    var server = http.createServer(function (request, response) {
      var reply = request.method + ' ' + request.url;
      response.end(reply);
    });

    var listenNative = ThaliMobileNativeWrapper.start(router).then(function () {
      return ThaliMobileNativeWrapper.startListeningForAdvertisements();
    });
    var listenServer = serverIsListening(server, 0);

    var findPeers = find(total);

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
        find.cleanup();
        t.end();
      });
  });

test('Multiple coordinated request ios native',
  function () {
    return platform.isAndroid ||
    global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI;
  },
  function (t) {
    var total = t.participants.length - 1;
    var find = peerFinder();

    var server = http.createServer(function (request, response) {
      var reply = request.method + ' ' + request.url;
      response.end(reply);
    });

    var listenNative = ThaliMobileNativeWrapper.start(router).then(function () {
      return ThaliMobileNativeWrapper.startListeningForAdvertisements();
    });
    var listenServer = serverIsListening(server, 0);

    var findPeers = find(total);

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
          t.equal(r[0].toString(), 'GET /path0');
          t.equal(r[1].toString(), 'GET /path1');
          t.equal(r[2].toString(), 'GET /path2');
        });
      })
      .catch(t.fail)
      .then(function () {
        find.cleanup();
        t.end();
      });
  });
