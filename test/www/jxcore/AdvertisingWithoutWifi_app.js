'use strict';

var SWITCH_TIMEOUT = 30 * 1000;
var TEST_TIMEOUT   = 2 * 60 * 1000;
var WIFI_TIMEOUT   = 10 * 1000;

if (typeof Mobile === 'undefined') {
  global.Mobile = require('./lib/wifiBasedNativeMock.js')();
}

var util   = require('util');
var format = util.format;

var assert       = require('assert');
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

function setWiFi(status) {
  var statusString = status? 'on' : 'off';

  function waitWifi(callback) {
    ThaliMobile.getNetworkStatus()
    .then(function (networkStatus) {
      if (networkStatus.wifi === statusString) {
        callback();
      } else {
        logger.warn(
          'we should be able to set wifi status to \'%s\' but the result status is \'%s\'',
          statusString, networkStatus.wifi
        );
        setTimeout(callback, WIFI_TIMEOUT);
      }
    });
  }

  return ThaliMobile.getNetworkStatus()
  .then(function (networkStatus) {
    if (networkStatus.wifi !== statusString) {
      return testUtils.toggleWifi(status)
      .then(function () {
        return new Promise(function (resolve) {
          waitWifi(resolve);
        });
      });
    }
  });
}

logger.debug('we need to enable wifi');
setWiFi(true)
.then(function () {
  logger.debug('wifi is ready');
  return thaliWifiInfrastructure.start(express.Router(), pskIdToSecret)
  .then(function () {
    return thaliWifiInfrastructure.startUpdateAdvertisingAndListening();
  });
})
.then(function () {
  logger.debug('we need to disable wifi');
  return setWiFi(false);
})
.then(function () {
  logger.debug('we need to wait a bit and enable wifi');
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      logger.debug('we are enabling wifi');
      setWiFi(true)
      .then(resolve).catch(reject);
    }, SWITCH_TIMEOUT);
  });
})
.then(function () {
  logger.debug('we are done');
});


logger.debug('AdvertisingWithoutWifi app is loaded');
setTimeout(function () {
  logger.debug('AdvertisingWithoutWifi app is finished');
}, TEST_TIMEOUT);
