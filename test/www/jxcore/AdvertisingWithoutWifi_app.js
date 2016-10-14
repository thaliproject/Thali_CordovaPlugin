'use strict';

var TIMEOUT = 10 * 60 * 1000;

if (typeof Mobile === 'undefined') {
  global.Mobile = require('./lib/wifiBasedNativeMock.js')();
}

var objectAssign = require('object-assign');
var Promise      = require('bluebird');
var express      = require('express');

var ThaliMobile              = require('thali/NextGeneration/thaliMobile');
var ThaliWifiInfrastructure  = require('thali/NextGeneration/thaliWifiInfrastructure');
var thaliWifiInfrastructure  = new ThaliWifiInfrastructure();

require('./lib/utils/process');
var logger    = require('./lib/testLogger')('Battery_app');
var testUtils = require('./lib/testUtils');


var config = require('./config.json');
objectAssign(process.env, config.env);

var pskIdentity = 'id';
var pskKey      = new Buffer('secret');

var pskIdToSecret = function (id) {
  return id === pskIdentity ? pskKey : null;
};

logger.debug('we are getting network status');
ThaliMobile.getNetworkStatus()
.then(function (networkStatus) {
  logger.debug('network status is: \'%s\'', JSON.stringify(networkStatus));

  if (networkStatus.wifi === 'on') {
    logger.debug('wifi is enabled, we need to disable the hardware wifi switch');
    return testUtils.toggleWifi(false);
  }
})

.then(function () {
  logger.debug('network is ready');
  return thaliWifiInfrastructure.start(express.Router(), pskIdToSecret);
})
.then(function () {
  logger.debug('wrapper is ready');
  return thaliWifiInfrastructure.startUpdateAdvertisingAndListening();
})
.then(function () {
  logger.debug('we are done');
});

logger.debug('AdvertisingWithoutWifi app is loaded');
setTimeout(function () {
  logger.debug('AdvertisingWithoutWifi app is finished');
}, TIMEOUT);
