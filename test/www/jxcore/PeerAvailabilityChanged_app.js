'use strict';

var TIMEOUT = 30 * 1000;

if (typeof Mobile === 'undefined') {
  global.Mobile = require('./lib/wifiBasedNativeMock.js')();
}

require('./lib/utils/process');
var logger = require('./lib/testLogger')('Battery_app');

var peersCount  = 0;
var eventsCount = 0;
var connectSucceeded = 0;
var alreadyConnected = 0;
var connectFailed = 0;
Mobile('peerAvailabilityChanged').registerToNative(function (peers) {
  peersCount += peers.length;
  eventsCount ++;

  peers.forEach(function (peer) {
    Mobile('connect').callNative(
      peer.peerIdentifier,
      function (error, connection) {
        if (error) {
          if (error.message === 'Already connect(ing/ed)') {
            alreadyConnected ++;
          } else {
            connectFailed ++;
          }
        } else {
          connectSucceeded ++;
          connection = JSON.parse(connection);
          var port = parseInt(connection.listeningPort, 10);
          // keep this connection alive.
          new net.Socket()
          .connect(port)
          .setKeepAlive(true, 1000);
        }
      }
    );
  });
});
Mobile('didRegisterToNative').callNative('peerAvailabilityChanged', function () {
  logger.debug('peerAvailabilityChanged is registered to native');
});

logger.debug('PeerAvailabilityChanged app is loaded');
setTimeout(function () {
  logger.debug(
    'we received %d peers and %d events, successful connections: %d, already connected: %d, failed connections: %d',
    peersCount, eventsCount, connectSucceeded, alreadyConnected, connectFailed
  );
  logger.debug('PeerAvailabilityChanged app is finished');
}, TIMEOUT);
