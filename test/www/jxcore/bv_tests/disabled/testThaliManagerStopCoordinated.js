'use strict';

var tape = require('../../lib/thaliTape');
if (!tape.coordinated) {
  return;
}

var testUtils = require('../../lib/testUtils.js');

var fs = require('fs-extra-promise');
var path = require('path');
var crypto = require('crypto');
var Promise = require('lie');
var PouchDB = require('pouchdb');
var ExpressPouchDB = require('express-pouchdb');

var sinon = require('sinon');
var proxyquire = require('proxyquire').noCallThru();

var salti = require('salti');
var PouchDBGenerator = require('thali/NextGeneration/utils/pouchDBGenerator');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var ThaliManager = require('thali/NextGeneration/thaliManager');
var ThaliPeerPoolDefault =
  require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');

// Public base64 key for local device should be passed
// to the tape 'setup' as 'tape.data'.
// This is required for tape.coordinated server to generate participants.
var ecdhForLocalDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
var publicKeyForLocalDevice = ecdhForLocalDevice.generateKeys();
var publicBase64KeyForLocalDevice = ecdhForLocalDevice.getPublicKey('base64');

// PouchDB name should be the same between peers.
var DB_NAME = 'ThaliManagerCoordinated';

PouchDB = testUtils.getLevelDownPouchDb();

var thaliManager;

var test = tape({
  setup: function (t) {
    t.data = publicKeyForLocalDevice.toJSON();
    t.end();
  },
  teardown: function (t) {
    thaliManager.stop()
    .then(function () {
      t.end();
    });
  }
});

test('test uncaught exception', function (t) {
  var spySalti;
  var allRequestsStarted = new Promise(function (resolve) {
    spySalti = sinon.spy(function () {
      var saltiFilter = salti.apply(this, arguments);

      // We will wait untill all these requests will be started.
      var dbPrefix = thaliConfig.BASE_DB_PATH + '/' + DB_NAME + '/';
      var done = 0;
      return function (req) {
        if (req.path === '/NotificationBeacons') {
          done |= 1;
        } else if (req.path === dbPrefix + '_changes') {
          done |= 1 << 1;
        } else if (req.path === dbPrefix + '_bulk_docs') {
          done |= 1 << 2;
        } else if (req.path.indexOf(dbPrefix + '_local') === 0) {
          done |= 1 << 3;
        }
        if (done === 0xf) {
          done = -1;
          setImmediate(function () {
            resolve();
          });
        }
        return saltiFilter.apply(this, arguments);
      };
    });
  });

  var ThaliManagerProxyquired =
  proxyquire('thali/NextGeneration/thaliManager', {
    'salti': spySalti
  });

  thaliManager = new ThaliManagerProxyquired(
    ExpressPouchDB,
    PouchDB,
    DB_NAME,
    ecdhForLocalDevice,
    new ThaliPeerPoolDefault()
  );

  // This function will return all participant's public keys
  // except local 'publicKeyForLocalDevice' one.
  var partnerKeys = testUtils.turnParticipantsIntoBufferArray(
    t, publicKeyForLocalDevice
  );

  // We are creating a local db for each participant.
  var pouchDB = new PouchDB(DB_NAME);

  pouchDB.put({
    _id: publicBase64KeyForLocalDevice
  })
  .then(function () {
    return thaliManager.start(partnerKeys);
  })
  .then(function () {
    return allRequestsStarted;
  })
  .then(function () {
    t.end();
  })
});
