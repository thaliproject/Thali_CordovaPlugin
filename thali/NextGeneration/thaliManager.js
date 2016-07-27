'use strict';

var logger = require('../thalilogger')('thaliManager');

var ThaliMobile = require('./thaliMobile');
var thaliConfig = require('./thaliConfig');
var ThaliSendNotificationBasedOnReplication = require('./replication/thaliSendNotificationBasedOnReplication');
var ThaliPullReplicationFromNotification = require('./replication/thaliPullReplicationFromNotification');

var express = require('express');
var salti = require('salti');

/**
 * @classdesc This may look like a class but it really should only have one
 * instance or bad stuff can happen.
 * @public
 * @param {expressPouchdb} expressPouchDB The express-pouchdb object we are
 * supposed to use to create the router.
 * @param {PouchDB} PouchDB PouchDB object we are supposed to use to create
 * dbs. Typically this should have PouchDB.defaults set with db to
 * require('leveldown-mobile') and prefix to the path where the application
 * wishes to store the DB.
 * @param {string} dbName Name of the db, both locally and remotely that we are
 * interacting with.
 * @param {Crypto.ECDH} ecdhForLocalDevice A Crypto.ECDH object initialized with
 * the local device's public and private keys.
 * @param {module:thaliPeerPoolInterface~ThaliPeerPoolInterface} [thaliPeerPoolInterface]
 * If your app doesn't specify its own pool interface you will seriously
 * regret it as the default one has awful behavior. Building your own
 * thaliPeerPoolInterface is pretty much a requirement for a decent Thali app.
 * @constructor
 */
function ThaliManager(expressPouchDB,
                      PouchDB,
                      dbName,
                      ecdhForLocalDevice,
                      thaliPeerPoolInterface) {
  logger.debug("creating router instance");
  
  this._router = express.Router();
  this._router.all('*', function(req, res, next) {
    console.log(
      req.connection.authorized,
      req.connection.pskIdentity,
      req.connection.pskRole
    );
    next();
  });
  this._router.all(thaliConfig.BASE_DB_PATH, salti(dbName, ThaliManager.acl, function () {}));

  logger.debug("creating ThaliSendNotificationBasedOnReplication instance");
  
  this._thaliSendNotificationBasedOnReplication =
    new ThaliSendNotificationBasedOnReplication(
        this._router,
        ecdhForLocalDevice,
        thaliConfig.BEACON_MILLISECONDS_TO_EXPIRE,
        new PouchDB(dbName));

  logger.debug("creating ThaliPullReplicationFromNotification instance");
  
  this._thaliPullReplicationFromNotification =
    new ThaliPullReplicationFromNotification(
        PouchDB,
        dbName,
        thaliPeerPoolInterface,
        ecdhForLocalDevice);

  logger.debug("creating express pouchdb instance");

  this._router.use(thaliConfig.BASE_DB_PATH, expressPouchDB(PouchDB, {
    mode: 'minimumForPouchDB'
  }));
}

ThaliManager.acl = [
  {
    'role': 'repl',
    'paths': [
      {
        'path': '/',
        'verbs': ['GET']
      },
      {
        'path': '/{:db}',
        'verbs': ['GET']
      },
      {
        'path': '/{:db}/_all_docs',
        'verbs': ['GET', 'HEAD', 'POST']
      },
      {
        'path': '/{:db}/_bulk_get',
        'verbs': ['POST']
      },
      {
        'path': '/{:db}/_changes',
        'verbs': ['GET', 'POST']
      },
      {
        'path': '/:db/_revs_diff',
        'verbs': ['POST']
      },
      {
        'path': '/:db/:id',
        'verbs': ['GET']
      },
      {
        'path': '/:db/:id/attachment',
        'verbs': ['GET']
      },
      {
        'path': '/{:db}/_local/{:id}',
        'verbs': ['GET', 'PUT', 'DELETE']
      },
      {
        'path': '/{:db}/_local/thali_{:id}',
        'verbs': ['GET', 'PUT', 'DELETE']
      }
    ]
  },
  {
    'role': 'beacon',
    'paths': [
      {
        'path': '/NotificationBeacons',
        'verbs': ['GET']
      }
    ]
  }
];

/**
 * Starts up everything including listening for advertisements, sending out
 * own advertisements, generating beacons to notify peers that we have data
 * for them as well as running pull replication jobs to pull data from other
 * peers who have data for us.
 *
 * This method is not idempotent as each call to start with different arguments
 * will cause the related states to be changed.
 *
 * @param {Buffer[]} [arrayOfRemoteKeys] This is the list of ECDH public keys
 * that we should be willing to send notifications of our changes to and receive
 * notifications of changes from.
 * @returns {Promise<?Error>}
 */
ThaliManager.prototype.start = function (arrayOfRemoteKeys) {
    var self = this;
    
    logger.debug("starting thaliPullReplicationFromNotification");
    self._thaliPullReplicationFromNotification.start(arrayOfRemoteKeys);
    
    logger.debug("starting ThaliMobile");
    return ThaliMobile.start(
      self._router,
      self._thaliSendNotificationBasedOnReplication.getPskIdToSecret())
    
    .then(function () {
      /*
      Ideally we could call startListening and startUpdateAdvertising separately
      but this causes problems in iOS. The issue is that we deal with the
      restriction that there can only be one MCSession between two devices by
      having a leader election where one device will always form the session.
      Imagine that there is device A and B. B is advertising. A hears the
      advertisement and wants to connect but it can't start the session. So what
      it has to do is send an invite to B, who will reject the invite but then
      respond with its own invite to A. For this to work however B has to be
      listening for advertisements (not just making them) because otherwise
      there is no way in iOS for A to ask B for a session (that will be
      refused). Simultaneously A must be listening for advertisements (or it
      wouldn't have heard B) and it must be advertising itself or B couldn't
      establish the MCSession with it. So in practice this means that in iOS
      everyone has to be both listening and advertising at the same time.
       */
      logger.debug("start listening for advertisements");
      return ThaliMobile.startListeningForAdvertisements();
    })
    
    .then(function () {
      logger.debug("start update advertising and listening");
      return ThaliMobile.startUpdateAdvertisingAndListening();
    })
    
    .then(function () {
      logger.debug("starting thaliSendNotificationBasedOnReplication");
      self._thaliSendNotificationBasedOnReplication.start(arrayOfRemoteKeys);
    });
  };

/**
 * Shuts down the radios and deactivates all replications.
 *
 * @returns {Promise<?Error>}
 */
ThaliManager.prototype.stop = function () {
  var self = this;
  
  logger.debug("stopping thaliSendNotificationBasedOnReplication");
  this._thaliSendNotificationBasedOnReplication.stop();
  
  logger.debug("stopping advertising and listening");
  return ThaliMobile.stopAdvertisingAndListening()
  
  .then(function () {
    logger.debug("stopping listening for advertisements");
    return ThaliMobile.stopListeningForAdvertisements();
  })
  
  .then(function () {
    logger.debug("stopping ThaliMobile");
    return ThaliMobile.stop();
  })
  
  .then(function () {
    logger.debug("stopping thaliPullReplicationFromNotification");
    self._thaliPullReplicationFromNotification.stop();
  });
};

module.exports = ThaliManager;
