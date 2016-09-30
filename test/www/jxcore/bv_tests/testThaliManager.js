'use strict';

var tape = require('../lib/thaliTape');
var testUtils = require('../lib/testUtils.js');

var fs = require('fs-extra-promise');
var extend = require('js-extend').extend;
var path = require('path');
var crypto = require('crypto');
var Promise = require('bluebird');
var PouchDB = require('pouchdb');
var express = require('express');
var expressPouchDB = require('express-pouchdb');

var sinon = require('sinon');
var proxyquire = require('proxyquire').noCallThru();

var Salti = require('salti');
var PouchDBGenerator = require('thali/NextGeneration/utils/pouchDBGenerator');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var ThaliPeerPoolDefault =
  require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');

var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var ThaliSendNotificationBasedOnReplication =
  require('thali/NextGeneration/replication/thaliSendNotificationBasedOnReplication');
var ThaliPullReplicationFromNotification =
  require('thali/NextGeneration/replication/thaliPullReplicationFromNotification');
var ThaliNotificationServer =
  require('thali/NextGeneration/notification/thaliNotificationServer');

// Public key for local device should be passed
// to the tape 'setup' as 'tape.data'.
var ecdhForLocalDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
var publicKeyForLocalDevice = ecdhForLocalDevice.generateKeys();

var TEST_TIMEOUT = 5 * 60 * 1000; // 5 minutes

var test = tape({
  setup: function (t) {
    t.data = publicKeyForLocalDevice.toJSON();
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

function Mocks(t) {
  // All objects should be cloned in order to prevent
  // 'already wrapped' error by 'sinon.spy'.

  this.t = t;

  this.express          = sinon.spy(express);
  this.expressPouchDB   = sinon.spy(expressPouchDB);
  this.LevelDownPouchDB = sinon.spy(testUtils.getLevelDownPouchDb());

  this.ThaliMobile = extend({}, ThaliMobile);

  this.MobileStart = sinon.spy(this.ThaliMobile, 'start');
  this.MobileStop  = sinon.spy(this.ThaliMobile, 'stop');

  this.MobileStartLA = sinon.spy(
    this.ThaliMobile, 'startListeningForAdvertisements'
  );
  this.MobileStopLA = sinon.spy(
    this.ThaliMobile, 'stopListeningForAdvertisements'
  );

  this.MobileStartUAA = sinon.spy(
    this.ThaliMobile, 'startUpdateAdvertisingAndListening'
  );
  this.MobileStopUAA = sinon.spy(
    this.ThaliMobile, 'stopAdvertisingAndListening'
  );

  this.Notification = sinon.spy(
    ThaliSendNotificationBasedOnReplication
  );
  this.Notification.prototype = extend(
    {},
    ThaliSendNotificationBasedOnReplication.prototype
  );
  this.NotificationStart = sinon.spy(
    this.Notification.prototype, 'start'
  );
  this.NotificationStop = sinon.spy(
    this.Notification.prototype, 'stop'
  );

  this.Replication = sinon.spy(
    ThaliPullReplicationFromNotification
  );
  this.Replication.prototype = extend(
    {},
    ThaliPullReplicationFromNotification.prototype
  );
  this.ReplicationStart = sinon.spy(
    this.Replication.prototype, 'start'
  );
  this.ReplicationStop = sinon.spy(
    this.Replication.prototype, 'stop'
  );

  this.Salti = sinon.spy(Salti);
  this.ThaliManager =
    proxyquire('thali/NextGeneration/thaliManager', {
      './replication/thaliSendNotificationBasedOnReplication':
        this.Notification,
      './replication/thaliPullReplicationFromNotification':
        this.Replication,
      './thaliMobile': this.ThaliMobile,
      'express': this.express,
      'salti': this.Salti
    });
}

Mocks.prototype.resetStartStop = function() {
  this.MobileStart.reset();
  this.MobileStop.reset();

  this.MobileStartLA.reset();
  this.MobileStopLA.reset();

  this.MobileStartUAA.reset();
  this.MobileStopUAA.reset();

  this.NotificationStart.reset();
  this.NotificationStop.reset();

  this.ReplicationStart.reset();
  this.ReplicationStop.reset();
}

Mocks.prototype.checkInit = function(dbName, ecdh, peerPool) {
  this.checkExpressPouchDB();
  this.checkPouchDB(dbName);
  this.checkNotification(ecdh);
  this.checkReplication(dbName, peerPool, ecdh);
  this.checkSalti(dbName);
}
Mocks.prototype.checkStart = function(partnerKeys, networkType) {
  this.checkMobileStart(networkType);
  this.checkMobileStartLA();
  this.checkMobileStartUAA();
  this.checkNotificationStart(partnerKeys);
  this.checkReplicationStart(partnerKeys);
}
Mocks.prototype.checkStop = function() {
  this.checkMobileStop();
  this.checkMobileStopLA();
  this.checkMobileStopUAA();
  this.checkNotificationStop();
  this.checkReplicationStop();
}

Mocks.prototype.checkExpressPouchDB = function() {
  var self = this;
  testUtils.checkArgs(
    this.t, this.expressPouchDB, 'expressPouchDB',
    [
      {
        description: 'PouchDB',
        compare: function (arg) {
          return typeof arg === 'function' &&
            arg === self.LevelDownPouchDB;
        }
      },
      {
        description: 'expressPouchDB options',
        compare: function (arg) {
          return typeof arg === 'object' &&
            arg.mode === 'minimumForPouchDB';
        }
      }
    ]
  );
}

Mocks.prototype.checkPouchDB = function(dbName) {
  testUtils.checkArgs(
    this.t, this.LevelDownPouchDB, 'PouchDB',
    [{
      description: 'dbName',
      compare: function (arg) {
        return typeof arg === 'string' &&
          arg === dbName;
      }
    }]
  );
}

Mocks.prototype.checkReplication = function(dbName, peerPool, ecdh) {
  var self = this;
  testUtils.checkArgs(
    this.t, this.Replication, 'ThaliPullReplicationFromNotification',
    [
      {
        description: 'PouchDB',
        compare: function (arg) {
          return typeof arg === 'function' &&
            arg === self.LevelDownPouchDB;
        }
      },
      {
        description: 'dbName',
        compare: function (arg) {
          return typeof arg === 'string' &&
            arg === dbName;
        }
      },
      {
        description: 'ThaliPeerPoolInterface instance',
        compare: function (arg) {
          return typeof arg === 'object' &&
            arg instanceof ThaliPeerPoolDefault &&
            arg === peerPool;
        }
      },
      {
        description: 'ecdhForLocalDevice',
        compare: function (arg) {
          return typeof arg === 'object' &&
            arg === ecdh;
        }
      }
    ]
  );
}
Mocks.prototype.checkReplicationStart = function(remoteKeys) {
  testUtils.checkArgs(
    this.t, this.ReplicationStart,
    'ThaliPullReplicationFromNotification.prototype.start',
    [{
      description: 'remoteKeys',
      compare: function (arg) {
        return Array.isArray(arg) &&
          arg === remoteKeys;
      }
    }]
  );
}
Mocks.prototype.checkReplicationStop = function() {
  testUtils.checkArgs(
    this.t, this.ReplicationStop,
    'ThaliPullReplicationFromNotification.prototype.stop',
    []
  );
}

Mocks.prototype.checkNotification = function(ecdh) {
  var self = this;
  testUtils.checkArgs(
    this.t, this.Notification, 'ThaliSendNotificationBasedOnReplication',
    [
      {
        description: 'express.Router instance',
        compare: function (arg) {
          return typeof arg === 'function' &&
            // This is not possible to check instanceof express.Router.
            typeof arg.__proto__ === 'function' &&
            arg.__proto__ === self.express.Router;
        }
      },
      {
        description: 'ecdhForLocalDevice',
        compare: function (arg) {
          return typeof arg === 'object' &&
            arg === ecdh;
        }
      },
      {
        description: 'thaliConfig.BEACON_MILLISECONDS_TO_EXPIRE',
        compare: function (arg) {
          return typeof arg === 'number' &&
            arg === thaliConfig.BEACON_MILLISECONDS_TO_EXPIRE;
        }
      },
      {
        description: 'PouchDB instance',
        compare: function (arg) {
          return typeof arg === 'object' &&
            arg instanceof PouchDB;
        }
      }
    ]
  );
}
Mocks.prototype.checkNotificationStart = function(remoteKeys) {
  testUtils.checkArgs(
    this.t, this.NotificationStart,
    'ThaliSendNotificationBasedOnReplication.prototype.start',
    [{
      description: 'remoteKeys',
      compare: function (arg) {
        return Array.isArray(arg) &&
          arg === remoteKeys;
      }
    }]
  );
}
Mocks.prototype.checkNotificationStop = function() {
  testUtils.checkArgs(
    this.t, this.NotificationStop,
    'ThaliSendNotificationBasedOnReplication.prototype.stop',
    []
  );
}

Mocks.prototype.checkMobileStart = function(networkType) {
  var self = this;
  testUtils.checkArgs(
    this.t, this.MobileStart, 'ThaliMobile.start',
    [
      {
        description: 'express.Router instance',
        compare: function (arg) {
          return typeof arg === 'function' &&
            // This is not possible to check instanceof express.Router.
            typeof arg.__proto__ === 'function' &&
            arg.__proto__ === self.express.Router;
        }
      },
      {
        description: 'getPskIdToSecret',
        compare: function (arg) {
          return typeof arg === 'function' &&
            arg.toString() === ThaliNotificationServer.prototype.getPskIdToSecret().toString();
        }
      },
      {
        description: 'networkType',
        compare: function (arg) {
          return arg === networkType;
        }
      }
    ]
  );
}
Mocks.prototype.checkMobileStartLA = function() {
  testUtils.checkArgs(
    this.t, this.MobileStartLA,
    'ThaliMobile.startListeningForAdvertisements',
    []
  );
}
Mocks.prototype.checkMobileStartUAA = function() {
  testUtils.checkArgs(
    this.t, this.MobileStartUAA,
    'ThaliMobile.startUpdateAdvertisingAndListening',
    []
  );
}

Mocks.prototype.checkMobileStop = function() {
  testUtils.checkArgs(
    this.t, this.MobileStop, 'ThaliMobile.stop', []
  );
}
Mocks.prototype.checkMobileStopLA = function() {
  testUtils.checkArgs(
    this.t, this.MobileStopLA,
    'ThaliMobile.stopListeningForAdvertisements',
    []
  );
}
Mocks.prototype.checkMobileStopUAA = function() {
  testUtils.checkArgs(
    this.t, this.MobileStopUAA,
    'ThaliMobile.stopAdvertisingAndListening',
    []
  );
}

Mocks.prototype.checkSalti = function(dbName) {
  var self = this;
  testUtils.checkArgs(
    this.t, this.Salti, 'Salti',
    [
      {
        description: 'dbName',
        compare: function (arg) {
          return typeof arg === 'string' &&
            arg === dbName;
        }
      },
      {
        description: 'acl',
        compare: function (arg) {
          return typeof arg === 'object' &&
            arg === self.ThaliManager._acl;
        }
      },
      {
        description: 'thaliIdCallback',
        compare: function (arg) {
          return typeof arg === 'function';
        }
      },
      {
        description: 'options',
        compare: function (arg) {
          return typeof arg === 'object' &&
            arg.dbPrefix === thaliConfig.BASE_DB_PATH;
        }
      }
    ]
  );
}

test('test thali manager spies', function (t) {
  testUtils.testTimeout(t, TEST_TIMEOUT);

  // This function will return all participant's public keys
  // except local 'publicKeyForLocalDevice' one.
  var partnerKeys;
  if (t.coordinated) {
    partnerKeys = testUtils.turnParticipantsIntoBufferArray(
      t, publicKeyForLocalDevice
    );
  } else {
    partnerKeys = [];
  }

  var mocks = new Mocks(t);

  // Creating thali manager with mocks.
  var dbName = testUtils.getRandomPouchDBName();
  var peerPool = new ThaliPeerPoolDefault();
  var thaliManager = new mocks.ThaliManager(
    mocks.expressPouchDB,
    mocks.LevelDownPouchDB,
    dbName,
    ecdhForLocalDevice,
    peerPool,
    global.NETWORK_TYPE
  );
  mocks.checkInit(dbName, ecdhForLocalDevice, peerPool);

  thaliManager.start(partnerKeys)
  .then(function () {
    mocks.checkStart(partnerKeys, global.NETWORK_TYPE);
  })
  .then(function () {
    return thaliManager.stop();
  })
  .then(function () {
    mocks.checkStop();
    t.end();
  });
});

test('test thali manager multiple starts and stops', function (t) {
  testUtils.testTimeout(t, TEST_TIMEOUT);

  // This function will return all participant's public keys
  // except local 'publicKeyForLocalDevice' one.
  var partnerKeys;
  if (t.coordinated) {
    partnerKeys = testUtils.turnParticipantsIntoBufferArray(
      t, publicKeyForLocalDevice
    );
  } else {
    partnerKeys = [];
  }

  var mocks = new Mocks(t);

  // Creating thali manager with mocks.
  var dbName = testUtils.getRandomPouchDBName();
  var peerPool = new ThaliPeerPoolDefault();
  var thaliManager = new mocks.ThaliManager(
    mocks.expressPouchDB,
    mocks.LevelDownPouchDB,
    dbName,
    ecdhForLocalDevice,
    peerPool,
    global.NETWORK_TYPE
  );
  mocks.checkInit(dbName, ecdhForLocalDevice, peerPool);

  // Multiple parallel starts.
  Promise.all([
    thaliManager.start(partnerKeys),
    thaliManager.start(partnerKeys),
    thaliManager.start(partnerKeys)
  ])
  // Multiple serial starts.
  .then(function () {
    return thaliManager.start(partnerKeys);
  })
  .then(function () {
    return thaliManager.start(partnerKeys);
  })
  .then(function () {
    mocks.checkStart(partnerKeys, global.NETWORK_TYPE);
  })

  // Multiple parallel stops.
  .then(function () {
    return Promise.all([
      thaliManager.stop(),
      thaliManager.stop(),
      thaliManager.stop()
    ]);
  })
  // Multiple serial stops.
  .then(function () {
    return thaliManager.stop();
  })
  .then(function () {
    return thaliManager.stop();
  })
  .then(function () {
    mocks.checkStop();
  })

  // Multiple parallel starts and stops.
  .then(function () {
    return Promise.all([
      thaliManager.start(partnerKeys),
      thaliManager.stop(),
      thaliManager.start(partnerKeys),
      thaliManager.stop(),
      thaliManager.start(partnerKeys),
      thaliManager.stop()
    ]);
  })
  .then(function () {
    return Promise.all([
      thaliManager.start(partnerKeys),
      thaliManager.start(partnerKeys),
      thaliManager.start(partnerKeys),
      thaliManager.stop(),
      thaliManager.stop(),
      thaliManager.stop()
    ]);
  })

  .then(function () {
    mocks.resetStartStop();
    return thaliManager.start(partnerKeys);
  })
  .then(function () {
    mocks.checkStart(partnerKeys, global.NETWORK_TYPE);
  })
  .then(function () {
    return thaliManager.stop();
  })
  .then(function () {
    t.end();
  });
});
