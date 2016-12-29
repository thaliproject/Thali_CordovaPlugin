'use strict';

var settings = {
  net: 'both', // 'wifi', 'native', 'both'
  mode: 'both', // 'listen-only', 'advertise-only', 'both', 'nothing'
  timeout: 10 * 60 * 1000
};

if (typeof Mobile === 'undefined') {
  global.Mobile = require('./lib/wifiBasedNativeMock.js')();
}

var objectAssign = require('object-assign');
var Promise      = require('bluebird');
var express      = require('express');

var ThaliMobile              = require('thali/NextGeneration/thaliMobile');
var ThaliWifiInfrastructure  = require('thali/NextGeneration/thaliWifiInfrastructure');
var thaliWifiInfrastructure  = new ThaliWifiInfrastructure();
var ThaliMobileNativeWrapper = require('thali/NextGeneration/thaliMobileNativeWrapper');

require('./lib/utils/process');
var logger    = require('./lib/testLogger')('Battery_app');
var testUtils = require('./lib/testUtils');


var config = require('./config');
objectAssign(process.env, config.env);

var isWifi = false, isNative = false;
var networkTypes;
switch(settings.net) {
  case 'wifi': {
    logger.debug('we are using wifi');
    isWifi = true;
    networkTypes = [ThaliMobile.networkTypes.WIFI];
    break;
  }
  case 'native': {
    logger.debug('we are using native');
    isNative = true;
    networkTypes = [ThaliMobile.networkTypes.NATIVE];
    break;
  }
  default: {
    logger.debug('we are using wifi and native');
    isWifi   = true;
    isNative = true;
    networkTypes = [ThaliMobile.networkTypes.BOTH];
  }
}

var isListening = false, isAdvertising = false;
switch(settings.mode) {
  case 'listen-only': {
    isListening = true;
    logger.debug('we are listening for advertisements');
    break;
  }
  case 'advertise-only': {
    isAdvertising = true;
    logger.debug('we are sending advertisements');
    break;
  }
  case 'both': {
    isListening   = true;
    isAdvertising = true;
    logger.debug('we are listening for advertisements and sending it');
    break;
  }
  default: {
    logger.debug('we have nothing to do');
  }
}


var pskIdentity = 'id';
var pskKey      = new Buffer('secret');

var pskIdToSecret = function (id) {
  return id === pskIdentity ? pskKey : null;
};

logger.debug('we are getting network status');
ThaliMobile.getNetworkStatus()
.then(function (networkStatus) {
  logger.debug('network status is: \'%s\'', JSON.stringify(networkStatus));

  var promises = [];
  if (networkStatus.wifi === 'off' && isWifi) {
    logger.debug('wifi is enabled, we need to enable the hardware wifi switch');
    promises.push(testUtils.toggleWifi(true));
  }
  if (networkStatus.bluetooth === 'off' && isNative) {
    logger.debug('native is enabled, we need to enable the hardware bluetooth switch');
    promises.push(testUtils.toggleBluetooth(true));
  }

  logger.debug('we are waiting when network will be ready');
  return Promise.all(promises);
})

.then(function () {
  logger.debug('network is ready');

  var promises = [];
  if (isWifi) {
    promises.push(thaliWifiInfrastructure.start(express.Router(), pskIdToSecret));
  }
  if (isNative) {
    promises.push(ThaliMobileNativeWrapper.start(express.Router(), pskIdToSecret));
  }

  logger.debug('we are starting wrappers');
  return Promise.all(promises);
})

.then(function () {
  logger.debug('wrappers are ready');

  var promises = [];
  if (isListening) {
    if (isWifi) {
      promises.push(thaliWifiInfrastructure.startListeningForAdvertisements());
    }
    if (isNative) {
      promises.push(ThaliMobileNativeWrapper.startListeningForAdvertisements());
    }
  }

  logger.debug('starting listening');
  return Promise.all(promises);
})

.then(function () {
  logger.debug('we are listening');

  var promises = [];
  if (isAdvertising) {
    if (isWifi) {
      promises.push(thaliWifiInfrastructure.startUpdateAdvertisingAndListening());
    }
    if (isNative) {
      promises.push(ThaliMobileNativeWrapper.startUpdateAdvertisingAndListening());
    }
  }

  logger.debug('starting advertising');
  return Promise.all(promises);
})

.then(function () {
  logger.debug('we are done');
});

logger.debug('Battery app is loaded');
setTimeout(function () {
  logger.debug('Battery app is finished');
}, settings.timeout);
