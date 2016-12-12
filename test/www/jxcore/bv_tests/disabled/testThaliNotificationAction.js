'use strict';
var tape = require('../lib/thaliTape');
var express = require('express');
var crypto = require('crypto');
var sinon = require('sinon');
var Promise = require('lie');
var testUtils = require('../lib/testUtils.js');
var httpTester = require('../lib/httpTester.js');

var ThaliMobileNativeWrapper =
  require('thali/NextGeneration/thaliMobileNativeWrapper');
var ThaliMobile =
  require('thali/NextGeneration/thaliMobile');
var NotificationAction =
  require('thali/NextGeneration/notification/thaliNotificationAction');
var NotificationBeacons =
  require('thali/NextGeneration/notification/thaliNotificationBeacons');
var ThaliPeerAction =
  require('thali/NextGeneration/thaliPeerPool/thaliPeerAction');
var thaliConfig =
  require('thali/NextGeneration/thaliConfig');

var TCP_NATIVE = ThaliMobileNativeWrapper.connectionTypes.TCP_NATIVE;

var globals = {};

/**
 * @classdesc This class is a container for all variables and
 * functionality that are common to most of the ThaliNoficationServer
 * tests.
 */
var GlobalVariables = function () {

  this.expressApp = express();
  this.expressRouter = express.Router();
  this.sourceKeyExchangeObject = crypto.createECDH(thaliConfig.BEACON_CURVE);
  this.sourcePublicKey = this.sourceKeyExchangeObject.generateKeys();
  this.sourcePublicKeyHash =
    NotificationBeacons.createPublicKeyHash(this.sourcePublicKey);

  this.actionAgent = httpTester.getTestAgent();
  this.testPeer = {
    peerIdentifier: 'identifier',
    generation: 0,
    connectionType: TCP_NATIVE
  };
  this.testPeerHostInfo = {
    hostAddress: '127.0.0.1',
    portNumber: null, // GlobalVariables#init updates this port to the real one
    suggestedTCPTimeout: 2000,
  };

  this.createPublicKeysToNotifyAndPreamble();
};

GlobalVariables.prototype.init = function () {
  var self = this;
  return httpTester.getTestHttpsServer(self.expressApp, self.expressRouter)
    .then(function (server) {
      self.expressServer = server;
      self.testPeerHostInfo.portNumber = server.address().port;
      return Promise.resolve();
    })
    .catch(function (failure) {
      return Promise.reject(failure);
    });
};

/**
 * Frees GlobalVariables instance's resources.
 * @returns {Promise<?Error>} Returns a promise that will resolve when the
 * resources are released.
 */
GlobalVariables.prototype.kill = function () {
  if (this.expressServer) {
    return this.expressServer.closeAllPromise();
  }
  return Promise.resolve();
};

GlobalVariables.prototype.createPublicKeysToNotifyAndPreamble = function () {
  this.targetPublicKeysToNotify = [];
  this.targetPublicKeysToNotifyHashes = [];
  this.targetDeviceKeyExchangeObjects = [];
  this.preambleAndBeacons = {};

  var device1 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device1Key = device1.generateKeys();
  var device1KeyHash = NotificationBeacons.createPublicKeyHash(device1Key);

  var device2 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device2Key = device2.generateKeys();
  var device2KeyHash = NotificationBeacons.createPublicKeyHash(device2Key);

  this.targetPublicKeysToNotify.push(device1Key, device2Key);
  this.targetPublicKeysToNotifyHashes.push(device1KeyHash, device2KeyHash);
  this.targetDeviceKeyExchangeObjects.push(device2, device2);

  this.preambleAndBeacons =
    NotificationBeacons.generatePreambleAndBeacons(
      this.targetPublicKeysToNotify, this.sourceKeyExchangeObject,
      60 * 60 * 1000);
};

var addressBookCallback = function (unencryptedKeyId) {
  if (unencryptedKeyId.compare(globals.sourcePublicKeyHash) === 0) {
    return globals.sourcePublicKey;
  }
  return null;
};

var sandbox = null;

var test = tape({
  setup: function (t) {
    sandbox = sinon.sandbox.create();
    globals = new GlobalVariables();
    globals.init().then(function () {
      t.end();
    }).catch(function (failure) {
      t.fail('Test setting up failed:' + failure);
      t.end();
    });
  },
  teardown: function (t) {
    sandbox.restore();
    globals.kill().then(function () {
      t.end();
    }).catch(function (failure) {
      t.fail('Server cleaning failed:' + failure);
      t.end();
    });
  }
});

test('Test BEACONS_RETRIEVED_AND_PARSED locally', function (t) {
  t.plan(8);

  httpTester.runServer(globals.expressRouter,
    thaliConfig.NOTIFICATION_BEACON_PATH,
    200, globals.preambleAndBeacons, 1);

  sandbox.stub(ThaliMobile, 'getPeerHostInfo')
    .withArgs(globals.testPeer.peerIdentifier, globals.testPeer.connectionType)
    .returns(Promise.resolve(globals.testPeerHostInfo));

  var act = new NotificationAction(
    globals.testPeer,
    globals.targetDeviceKeyExchangeObjects[0],
    addressBookCallback
  );

  act.eventEmitter.on(NotificationAction.Events.Resolved,
    function (action, res, beaconDetails) {
      t.equals(
        action.getPeerIdentifier(),
        globals.testPeer.peerIdentifier,
        'peerIdentifier should match');

      t.equals(
        action.getPeerGeneration(),
        globals.testPeer.generation,
        'generation should match');

      t.equals(
          res,
          NotificationAction.ActionResolution.BEACONS_RETRIEVED_AND_PARSED,
          'Response should be BEACONS_RETRIEVED_AND_PARSED');

      t.ok(beaconDetails.encryptedBeaconKeyId.compare(testUtils.extractBeacon(
          globals.preambleAndBeacons, 1)) === 0, 'good beacon');
      t.ok(beaconDetails.preAmble.compare(testUtils.extractPreAmble(
          globals.preambleAndBeacons)) === 0, 'good preAmble');
      t.ok(globals.sourcePublicKeyHash.compare(
          beaconDetails.unencryptedKeyId) === 0, 'public keys match!');
    });

  act.start(globals.actionAgent).then(function (res) {
    t.equals(res, null, 'must return null after successful call');
    t.equals(act.getActionState(), ThaliPeerAction.actionState.KILLED,
      'Once start returns the action should be in KILLED state');
  })
  .catch(function (failure) {
    t.fail(failure.stack);
  });
});

test('Test HTTP_BAD_RESPONSE locally', function (t) {
  t.plan(2);

  httpTester.runServer(globals.expressRouter,
    thaliConfig.NOTIFICATION_BEACON_PATH, 503, 'hello', 1);


  sandbox.stub(ThaliMobile, 'getPeerHostInfo')
    .withArgs(globals.testPeer.peerIdentifier, globals.testPeer.connectionType)
    .returns(Promise.resolve(globals.testPeerHostInfo));

  var act = new NotificationAction(
    globals.testPeer,
    globals.targetDeviceKeyExchangeObjects[0],
    addressBookCallback,
    TCP_NATIVE
  );

  act.eventEmitter.on(NotificationAction.Events.Resolved, function (_, res) {
    t.equals(
      res, NotificationAction.ActionResolution.HTTP_BAD_RESPONSE,
      'Response should be HTTP_BAD_RESPONSE'
    );
  });

  act.start(globals.actionAgent).then( function (res) {
    t.equals(res, null, 'must return null after successful call');
  }).catch(function (err) {
    t.fail('Test failed:' + err.message);
  });
});

test('Test NETWORK_PROBLEM locally', function (t) {
  t.plan(2);

  testUtils.makeDomainUnresolvable('unresolvable_domain');
  globals.testPeerHostInfo.hostAddress = 'unresolvable_domain';

  sandbox.stub(ThaliMobile, 'getPeerHostInfo')
    .withArgs(globals.testPeer.peerIdentifier, globals.testPeer.connectionType)
    .returns(Promise.resolve(globals.testPeerHostInfo));

  var act = new NotificationAction(
    globals.testPeer,
    globals.targetDeviceKeyExchangeObjects[0],
    addressBookCallback ,
    TCP_NATIVE
  );

  act.eventEmitter.on(NotificationAction.Events.Resolved, function (_, res) {
    t.equals(
      res, NotificationAction.ActionResolution.NETWORK_PROBLEM,
      'Response should be NETWORK_PROBLEM'
    );
  });

  act.start(globals.actionAgent).then(function () {
    t.fail('This call should cause reject.');
  }).catch(function (err) {
    testUtils.restoreUnresolvableDomains();
    t.equals(
      err.message, 'Could not establish TCP connection',
      'reject reason should be: Could not establish TCP connection'
    );
  });
});

test('Action fails when getPeerHostInfo fails', function (t) {
  t.plan(2);

  var errorMessage = 'Unspecified error';

  sandbox.stub(
    ThaliMobile,
    'getPeerHostInfo',
    function () {
      return Promise.reject(new Error(errorMessage));
    }
  );

  var act = new NotificationAction(
    globals.testPeer,
    globals.targetDeviceKeyExchangeObjects[0],
    addressBookCallback ,
    TCP_NATIVE
  );

  act.eventEmitter.on(NotificationAction.Events.Resolved, function (_, res) {
    t.equals(
      res, NotificationAction.ActionResolution.BAD_PEER,
      'Resolution should be BAD_PEER'
    );
  });

  act.start(globals.actionAgent).then( function () {
    t.fail('This call should cause reject.');
  }).catch(function (err) {
    t.equals(err.message, errorMessage, 'correct error message');
  });
});

test('Call the start two times', function (t) {
  t.plan(3);

  httpTester.runServer(globals.expressRouter,
    thaliConfig.NOTIFICATION_BEACON_PATH,
    200, globals.preambleAndBeacons, 1);

  sandbox.stub(ThaliMobile, 'getPeerHostInfo')
    .withArgs(globals.testPeer.peerIdentifier, globals.testPeer.connectionType)
    .returns(Promise.resolve(globals.testPeerHostInfo));

  var act = new NotificationAction(
    globals.testPeer,
    globals.targetDeviceKeyExchangeObjects[0],
    addressBookCallback,
    TCP_NATIVE
  );

  act.eventEmitter.on(NotificationAction.Events.Resolved, function (_, res) {
    t.equals(
      res,
      NotificationAction.ActionResolution.BEACONS_RETRIEVED_AND_PARSED,
      'Response should be BEACONS_RETRIEVED_AND_PARSED'
    );
  });


  act.start(globals.actionAgent).then( function (res) {
      t.equals(res, null, 'must return null after successful call.');
    })
    .catch(function (failure) {
      t.fail('Test failed:' + failure);
    });

  act.start(globals.actionAgent).then( function () {
      t.fail('Second start should not be successful.');
  }).catch( function (err) {
    t.equals(err.message, ThaliPeerAction.DOUBLE_START, 'Call start once');
  });
});

test('Call the kill before calling the start', function (t) {

  t.plan(2);

  sandbox.stub(ThaliMobile, 'getPeerHostInfo')
    .withArgs(globals.testPeer.peerIdentifier, globals.testPeer.connectionType)
    .returns(Promise.resolve(globals.testPeerHostInfo));

  var act = new NotificationAction(
    globals.testPeer,
    globals.targetDeviceKeyExchangeObjects[0],
    addressBookCallback,
    TCP_NATIVE
  );

  act.eventEmitter.on(NotificationAction.Events.Resolved, function (_, res) {
    t.equals(
      res, NotificationAction.ActionResolution.KILLED,
      'Should be Killed'
    );
  });
  act.kill();

  act.start(globals.actionAgent).catch( function (err) {
    t.equals(err.message, ThaliPeerAction.START_AFTER_KILLED,
      'Start after killed');
  });
});

test('Call the kill immediately after the start', function (t) {

  t.plan(2);

  // Sets 2000 milliseconds delay for request handling.
  httpTester.runServer(globals.expressRouter, '/NotificationBeacons', 503,
    'hello', 1, 2000);

  globals.testPeerHostInfo.suggestedTCPTimeout = 1;

  sandbox.stub(ThaliMobile, 'getPeerHostInfo')
    .withArgs(globals.testPeer.peerIdentifier, globals.testPeer.connectionType)
    .returns(Promise.resolve(globals.testPeerHostInfo));

  var act = new NotificationAction(
    globals.testPeer,
    globals.targetDeviceKeyExchangeObjects[0],
    addressBookCallback,
    TCP_NATIVE
  );

  act.eventEmitter.on(NotificationAction.Events.Resolved, function (_, res) {
    t.equals(
      res,
      NotificationAction.ActionResolution.KILLED,
      'Should be KILLED'
    );
  });

  act.start(globals.actionAgent).then(function (res) {
    t.equals(res, null, 'must return null after successful kill');
  })
  .catch(function (failure) {
    t.fail('Test failed:' + failure);
  });

  act.kill();

});

test('Call the kill while waiting a response from the server', function (t) {

  t.plan(2);

  // Sets 10000 milliseconds delay for request handling.
  httpTester.runServer(globals.expressRouter, '/NotificationBeacons', 503,
    'hello', 1, 10000);

  // Sets 10000 milliseconds TCP timeout.
  globals.testPeerHostInfo.suggestedTCPTimeout = 10000;

  sandbox.stub(ThaliMobile, 'getPeerHostInfo')
    .withArgs(globals.testPeer.peerIdentifier, globals.testPeer.connectionType)
    .returns(Promise.resolve(globals.testPeerHostInfo));

  var act = new NotificationAction(
    globals.testPeer,
    globals.targetDeviceKeyExchangeObjects[0],
    addressBookCallback,
    TCP_NATIVE
  );

  act.eventEmitter.on(NotificationAction.Events.Resolved, function (_, res) {
    t.equals(
      res, NotificationAction.ActionResolution.KILLED,
      'Should be KILLED'
    );
  });


  act.start(globals.actionAgent).then( function (res) {
    t.equals(
      res,
      null,
      'must return null after successful kill');
  }).catch(function (err) {
    t.fail('Test failed:' + err);
  });

  // This kills the action after 2 seconds. This should give enough time to
  // establish a HTTP connection in slow devices but since the server waits
  // 10 seconds before it answers we end up killing the connection when the
  // client is waiting the server to answer.

  setTimeout( function () {
    act.kill();
  }, 2000);

});

test('Test to exceed the max content size locally', function (t) {

  t.plan(2);

  var buffer = new Buffer(1024);
  buffer.fill('h');

  httpTester.runServer(globals.expressRouter,
    thaliConfig.NOTIFICATION_BEACON_PATH,
    200, buffer, 1+NotificationAction.MAX_CONTENT_SIZE_IN_BYTES/1024);

  // Sets 10000 milliseconds TCP timeout.
  globals.testPeerHostInfo.suggestedTCPTimeout = 10000;

  sandbox.stub(ThaliMobile, 'getPeerHostInfo')
    .withArgs(globals.testPeer.peerIdentifier, globals.testPeer.connectionType)
    .returns(Promise.resolve(globals.testPeerHostInfo));

  var act = new NotificationAction(
    globals.testPeer,
    globals.targetDeviceKeyExchangeObjects[0],
    addressBookCallback,
    TCP_NATIVE
  );

  act.eventEmitter.on(NotificationAction.Events.Resolved, function (_, res) {
    t.equals(
      res, NotificationAction.ActionResolution.HTTP_BAD_RESPONSE,
      'HTTP_BAD_RESPONSE should be response when content size is exceeded'
    );
  });

  act.start(globals.actionAgent).then( function (res) {
    t.equals(res, null, 'must return null after successful call');
  }).catch(function (failure) {
    t.fail('Test failed:' + failure);
  });
});

test('Close the server socket while the client is waiting a response ' +
  'from the server. Local test.',
  function (t) {

    t.plan(2);

    // Sets 10000 milliseconds delay for request handling.
    httpTester.runServer(globals.expressRouter, '/NotificationBeacons', 503,
      'hello', 1, 10000);

    // Sets 10000 milliseconds TCP timeout.
    globals.testPeerHostInfo.suggestedTCPTimeout = 10000;

    sandbox.stub(ThaliMobile, 'getPeerHostInfo')
      .withArgs(
        globals.testPeer.peerIdentifier,
        globals.testPeer.connectionType
      )
      .returns(Promise.resolve(globals.testPeerHostInfo));

    var act = new NotificationAction(
      globals.testPeer,
      globals.targetDeviceKeyExchangeObjects[0],
      addressBookCallback,
      TCP_NATIVE
    );

    act.eventEmitter.on(NotificationAction.Events.Resolved, function (_, res) {
      t.equals(
        res, NotificationAction.ActionResolution.NETWORK_PROBLEM,
        'Should be NETWORK_PROBLEM caused closing server socket'
      );
    });

    act.start(globals.actionAgent).then( function () {
      t.fail('Test should return failure: Could not establish TCP connection');
    }).catch(function (err) {
      t.equals(
        err.message,
        'Could not establish TCP connection',
        'Should be Could not establish TCP connection'
      );
    });

    // This kills the server socket after 2 seconds. This should give enough
    // time to establish a HTTPS connection in slow devices but since the server
    // waits 10 seconds before it answers we end up killing the connection when
    // the client is waiting the server to answer.

    setTimeout( function () {
      globals.kill().then(function () {
        globals.expressServer = null;
      });
    }, 2000);
  });

test('Close the client socket while the client is waiting a response ' +
  'from the server. Local test.',
  function (t) {

    t.plan(2);

    // Sets 10000 milliseconds delay for request handling.
    httpTester.runServer(globals.expressRouter, '/NotificationBeacons', 503,
      'hello', 1, 10000);

    // Sets 10000 milliseconds TCP timeout.
    globals.testPeerHostInfo.suggestedTCPTimeout = 10000;

    sandbox.stub(ThaliMobile, 'getPeerHostInfo')
      .withArgs(
        globals.testPeer.peerIdentifier,
        globals.testPeer.connectionType
      )
      .returns(Promise.resolve(globals.testPeerHostInfo));

    var act = new NotificationAction(
      globals.testPeer,
      globals.targetDeviceKeyExchangeObjects[0], addressBookCallback ,
      TCP_NATIVE
    );

    act.eventEmitter.on(NotificationAction.Events.Resolved, function (_, res) {
      t.equals(
        res, NotificationAction.ActionResolution.NETWORK_PROBLEM,
        'Should be NETWORK_PROBLEM caused closing client socket'
      );
    });

    act.start(globals.actionAgent).then( function () {
      t.fail('Test should return failure: Could not establish TCP connection');
    }).catch(function (err) {
      t.equals(
        err.message,
        'Could not establish TCP connection',
        'Should be Could not establish TCP connection');
    });

    // This kills the client socket after 2 seconds. This should give enough
    // time to establish a HTTP connection in slow devices but since the server
    // waits 10 seconds before it answers we end up killing the connection when
    // the client is waiting the server to answer.

    setTimeout( function () {
      Object.keys(globals.actionAgent.sockets).forEach(function (key) {
        globals.actionAgent.sockets[key].forEach(function (socket) {
          socket.destroy();
        });
      });
    }, 2000);
  });
