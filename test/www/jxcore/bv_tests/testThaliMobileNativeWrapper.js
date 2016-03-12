'use strict';

var express = require('express');
var http = require('http');

if (typeof Mobile === 'undefined') {
  return;
}

var thaliMobileNativeWrapper = require('thali/NextGeneration/thaliMobileNativeWrapper');
var validations = require('thali/validations');
var tape = require('../lib/thali-tape');

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    thaliMobileNativeWrapper.stop()
    .then(function () {
      t.end();
    })
    .catch(function (err) {
      t.fail('teardown failed with ' + JSON.stringify(err));
      t.end();
    })
  }
});

var testIdempotentFunction = function (t, functionName) {
  thaliMobileNativeWrapper.start(express.Router())
  .then(function () {
    return thaliMobileNativeWrapper[functionName]();
  })
  .then(function (error) {
    t.notOk(error, 'no errors');
    return thaliMobileNativeWrapper[functionName]();
  })
  .then(function (error) {
    t.notOk(error, 'still no errors');
    t.end();
  })
  .catch(function(error) {
    t.fail('testIdempotentFunction failed with ' + JSON.stringify(error));
    t.end();
  });
};

var testFunctionBeforeStart = function (t, functionName) {
  thaliMobileNativeWrapper[functionName]()
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
  thaliMobileNativeWrapper.getNonTCPNetworkStatus()
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
  thaliMobileNativeWrapper.start('bad router')
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
  test('Make sure all services are stopped when we call stop', function (t) {
    // TODO: Make sure we check that advertisingAndListening as well as
    // listeningForAdvertisements are turned off and the serversManager
    // and application server are deactivated
    t.fail('IMPLEMENT ME!!!');
    t.end();
  });

  test('make sure terminateConnection is properly hooked up', function (t) {
    // TODO: Our goal is NOT to test that the function works since it is
    // thaliTcpServersManager job to do that. Our job is just to make sure
    // we are calling it correctly.
    t.fail('IMPLEMENT ME!!!!');
    t.end();
  });

  test('make sure terminateListener is properly hooked up', function (t) {
    // TODO: Same as above
    t.fail('IMPLEMENT ME!!!!');
    t.end();
  });

  test('make sure we actually call kill connections property', function (t) {
    // TODO: Implement me!
    t.fail('IMPLEMENT ME!!!!');
    t.end();
  });

  test('peer changes handled from a queue', function (t) {
    thaliMobileNativeWrapper.start(express.Router())
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
        thaliMobileNativeWrapper.emitter.removeListener(
          'nonTCPPeerAvailabilityChangedEvent',
          peerAvailabilityHandler);
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
      thaliMobileNativeWrapper.emitter.on('nonTCPPeerAvailabilityChangedEvent',
        peerAvailabilityHandler);
      Mobile.firePeerAvailabilityChanged(getDummyPeers(true));
    });
  });

  test('thaliMobileNativeWrapper is stopped when ' +
    'incomingConnectionToPortNumberFailed is received',
    function (t) {
      var routerPort = 0;
      thaliMobileNativeWrapper.emitter
        .once('incomingConnectionToPortNumberFailed', function (err) {
          t.equal(err.reason,
                  thaliMobileNativeWrapper.routerFailureReason.NATIVE_LISTENER,
                  'right error reason');
          t.ok(err.errors.length === 0, 'Stop should be fine');
          t.equal(err.routerPort, routerPort, 'same port');
          t.notOk(thaliMobileNativeWrapper._isStarted(), 'we should be off')
          t.end();
        });
      thaliMobileNativeWrapper.start(express.Router())
      .then(function () {
        routerPort = thaliMobileNativeWrapper._getServersManagerLocalPort();
        return thaliMobileNativeWrapper.startUpdateAdvertisingAndListening();
      })
      .then(function () {
        Mobile.fireIncomingConnectionToPortNumberFailed(routerPort);
      });
    });

  test('thaliMobileNativeWrapper is stopped when routerPortConnectionFailed ' +
    'is received', function (t) {
    // TODO: Implement
    t.fail('IMPLEMENT ME!!!!');
    t.end();
  });

  test('We repeat failedConnection event when we get it from ' +
    'thaliTcpServersManager', function (t) {
    t.fail('IMPLEMENT ME!!!!!!');
    t.end();
  });

  test('relaying discoveryAdvertisingStateUpdateNonTCP', function (t) {
    thaliMobileNativeWrapper.start(express.Router())
    .then(function () {
      thaliMobileNativeWrapper.emitter.once(
        'discoveryAdvertisingStateUpdateNonTCP',
        function (discoveryAdvertisingStateUpdateValue) {
          t.ok(discoveryAdvertisingStateUpdateValue.discoveryActive,
            'discovery is active');
          t.ok(discoveryAdvertisingStateUpdateValue.advertisingActive,
            'advertising is active');
          t.end();
        }
      );
      Mobile.fireDiscoveryAdvertisingStateUpdateNonTCP({
        discoveryActive: true,
        advertisingActive: true
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
    thaliMobileNativeWrapper.emitter.removeListener(
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
  thaliMobileNativeWrapper.emitter.on('nonTCPPeerAvailabilityChangedEvent',
    peerAvailabilityHandler);

  thaliMobileNativeWrapper.start(router)
  .then(function () {
    return thaliMobileNativeWrapper.startListeningForAdvertisements();
  })
  .then(function () {
    return thaliMobileNativeWrapper.startUpdateAdvertisingAndListening();
  })
  .then(function () {
    t.ok(true, 'was able call necessary starts');
  });
});
*/

test('Can do requests between peers after start and stop', function (t) {
  // TODO: A great way to shake out bugs is to call start, exchange messages,
  // call stop, call start again, exchange messages and then call stop and
  // check along the way that our state is working correctly.
  t.fail('Implement Me!!!!');
  t.end();
});

test('We successfully receive and replay discoveryAdvertisingStateUpdate',
  function (t) {
    // TODO: This really needs to be run live
    t.fail('IMPLEMENT ME!!!!');
    t.end();
});
