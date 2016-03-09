'use strict';

var express = require('express');
var http = require('http');

if (typeof Mobile === 'undefined') {
  return;
}

var ThaliMobileNativeWrapper = require('thali/NextGeneration/thaliMobileNativeWrapper');
var validations = require('thali/validations');
var tape = require('../lib/thali-tape');

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    ThaliMobileNativeWrapper.stop()
    .then(function () {
      t.end();
    });
  }
});

var testIdempotentFunction = function (t, functionName) {
  ThaliMobileNativeWrapper.start(express.Router())
  .then(function () {
    return ThaliMobileNativeWrapper[functionName]();
  })
  .then(function (error) {
    t.notOk(error, 'no errors');
    return ThaliMobileNativeWrapper[functionName]();
  })
  .then(function (error) {
    t.notOk(error, 'still no errors');
    t.end();
  });
};

var testFunctionBeforeStart = function (t, functionName) {
  ThaliMobileNativeWrapper[functionName]()
  .then(function () {
    t.fail('call should not succeed');
    t.end();
  })
  .catch(function (error) {
    t.equal(error.message, 'Call Start!', 'specific error should be returned');
    t.end();
  });
};

test('#startListeningForAdvertisements should fail if start not called',
  function (t) {
    testFunctionBeforeStart(t, 'startListeningForAdvertisements');
  }
);

test('#startUpdateAdvertisingAndListening should fail if start not called',
  function (t) {
    testFunctionBeforeStart(t, 'startUpdateAdvertisingAndListening');
  }
);

test('should be able to call #stopListeningForAdvertisements many times',
  function (t) {
    testIdempotentFunction(t, 'stopListeningForAdvertisements');
  }
);

test('should be able to call #startListeningForAdvertisements many times',
  function (t) {
    testIdempotentFunction(t, 'startListeningForAdvertisements');
  }
);

test('should be able to call #startUpdateAdvertisingAndListening many times',
  function (t) {
    testIdempotentFunction(t, 'startUpdateAdvertisingAndListening');
  }
);

test('should be able to call #stopAdvertisingAndListening many times',
  function (t) {
    testIdempotentFunction(t, 'stopAdvertisingAndListening');
  }
);

test('can get the network status before starting', function (t) {
  ThaliMobileNativeWrapper.getNonTCPNetworkStatus()
  .then(function (networkChangedValue) {
    t.doesNotThrow(function () {
      var requiredProperties = [
        'wifi',
        'bluetooth',
        'bluetoothLowEnergy',
        'cellular'
      ];
      for (var index in requiredProperties) {
        validations.ensureNonNullOrEmptyString(
          networkChangedValue[requiredProperties[index]]);
      }
    }, 'network status should have certain non-empty properties');
    t.end();
  });
});

test('error returned with bad router', function (t) {
  ThaliMobileNativeWrapper.start('bad router')
  .then(function () {
    t.fail('should not succeed');
    t.end();
  })
  .catch(function (error) {
    t.equals(error.message, 'Bad Router', 'specific error expected');
    t.end();
  });
});

if (!jxcore.utils.OSInfo().isMobile) {
  test('peer changes handled from a queue', function (t) {
    ThaliMobileNativeWrapper.start(express.Router())
    .then(function () {
      var peerAvailabilityHandler;
      var peerCount = 10;
      var getDummyPeers = function (peerAvailable) {
        var dummyPeers = [];
        for (var i = 1; i <= peerCount; i++) {
          dummyPeers.push({
            peerIdentifier: i + '',
            peerAvailable: peerAvailable,
            pleaseConnect: false
          });
        }
        return dummyPeers;
      };
      var endTest = function () {
        ThaliMobileNativeWrapper.emitter.removeListener(
          'nonTCPPeerAvailabilityChangedEvent',
          peerAvailabilityHandler
        );
        Mobile.firePeerAvailabilityChanged(getDummyPeers(false));
        t.end();
      };
      var previousPeerNumber = 0;
      peerAvailabilityHandler = function (peer) {
        var peerNumber = parseInt(peer.peerIdentifier);
        if (peerNumber - 1 !== previousPeerNumber) {
          t.fail('peers should be handled in order');
          endTest();
        }
        previousPeerNumber = peerNumber;
        if (peerNumber === peerCount) {
          t.ok(true, 'peers were handled in the right order');
          endTest();
        }
      };
      ThaliMobileNativeWrapper.emitter.on('nonTCPPeerAvailabilityChangedEvent',
        peerAvailabilityHandler);
      Mobile.firePeerAvailabilityChanged(getDummyPeers(true));
    });
  });

  test('Servers manager is restarted when incomingConnectionToPortNumberFailed is received', function (t) {
    ThaliMobileNativeWrapper.start(express.Router())
    .then(function () {
      return ThaliMobileNativeWrapper.startUpdateAdvertisingAndListening();
    })
    .then(function () {
      var localPort = ThaliMobileNativeWrapper._getServersManagerLocalPort();
      Mobile.fireIncomingConnectionToPortNumberFailed();
      setImmediate(function () {
        t.notEquals(
          localPort,
          ThaliMobileNativeWrapper._getServersManagerLocalPort(),
          'the port should have changed in the restart'
        );
        t.end();
      });
    });
  });
}

if (!tape.coordinated) {
  return;
}
/*
test('can do HTTP requests between peers', function (t) {
  var testPath = '/test';
  var testData = 'foobar';
  var router = express.Router();
  router.get(testPath, function (req, res) {
    res.send(testData);
  });

  var peerAvailabilityHandler = function (peer) {
    ThaliMobileNativeWrapper.emitter.removeListener(
      'nonTCPPeerAvailabilityChangedEvent',
      peerAvailabilityHandler
    );
    http.get({
      path: testPath,
      port: peer.portNumber,
      agent: false // to prevent connection keep-alive
    }, function (res) {
      t.equal(res.statusCode, 200, 'server should respond with code 200');
      t.equal(res.TODO, testData, 'test data should have been received');
      t.end();
    });
  };
  ThaliMobileNativeWrapper.emitter.on('nonTCPPeerAvailabilityChangedEvent',
    peerAvailabilityHandler);

  ThaliMobileNativeWrapper.start(router)
  .then(function () {
    return ThaliMobileNativeWrapper.startListeningForAdvertisements();
  })
  .then(function () {
    return ThaliMobileNativeWrapper.startUpdateAdvertisingAndListening();
  })
  .then(function () {
    t.ok(true, 'was able call necessary starts');
  });
});
*/