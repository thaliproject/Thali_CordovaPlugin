'use strict';

var TIMEOUT = 30 * 1000;

if (typeof Mobile === 'undefined') {
  global.Mobile = require('./lib/wifiBasedNativeMock.js')();
}

require('./lib/utils/process');
var logger = require('./lib/testLogger')('Battery_app');

var peersCount  = 0;
var eventsCount = 0;
Mobile('peerAvailabilityChanged').registerToNative(function (peers) {
  peersCount += peers.length;
  eventsCount ++;
});
Mobile('didRegisterToNative').callNative('peerAvailabilityChanged', function () {
  logger.debug('peerAvailabilityChanged is registered to native');
});

logger.debug('PeerAvailabilityChanged app is loaded');
setTimeout(function () {
  logger.debug('we received %d peers and %d events', peersCount, eventsCount);
  logger.debug('PeerAvailabilityChanged app is finished');
}, TIMEOUT);
