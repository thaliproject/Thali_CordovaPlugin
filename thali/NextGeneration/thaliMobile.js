"use strict";

var Promise = require("lie");

/** @module thaliMobile */

/*
Does the connection layer deal with the muxer or do we have another layer in between that deals with the muxer?
I think we should define the connection layer, see how it looks and then go from there.

startListeningForAdvertisements - Makes perfect sense for SSDP
startUpdateAdvertisingAndListenForIncomingConnections - This one makes sense as well so long as we are passing in
the app server instance so we can call https.createSErver(app).listen(port we pick, public IP on WiFi). This is
particularly the case because the IP can and will change. So we need to have logic that will stop listening on
the IP when we lose a connection to wifi.

The experience we want is that we will fire a peerAvailabilityChanged event that will always include an IP
address and port. The idea is that the IP might be localhost in case it's a non-TCP/IP connection and otherwise
is just the local IP address. This means that every time we find a peer we have to open a port and sit on it until
the user connects. They might not connect at all because they might not want to deal with the peer. So we need
to keep the number of ports we open to a reasonable level so we don't starve out the system. Although given the
endless limitations we see in the P2P stacks I'm not sure this is a real concern. :(

The idea is that the port would be owned by the multiplexer who would just sit on it doing nothing. It would then
time out if the user doesn't open it. If they do open it then the multiplexer would be the one who calls connect to
get the bridges going.

Big thanks to Ville who pushed for the idea that we should make everything into addresses and ports and thus
hide connect from the higher layers.

The more I work on this the more I'm convinced that this layer is pretty useless. In the end we will need to manage
the wifi and non-tcp layers separately to deal with their various errors and retries. The problem is really just
the higher layers.
 */

/**
 * @file
 *
 * This is the unified interface for managing both WiFi Infrastructure Mode (if available) and non-TCP/IP transport
 * (if available) discovery and connectivity infrastructures. The programmer still has to turn on and off
 * the WiFi and non-TCP/IP functionality separately. But there is a common infrastructure for updating advertising
 * as well as for connecting to peers.
 *
 * We have chosen to not collapse the start and stop methods into a single method because the error handling is just
 * too annoying.
 */

/**
 * This just calls {@link module:thaliWifiInfrastructure.startListeningForAdvertisements}. See there for
 * definition of behavior.
 *
 * @returns {Promise<null|Error>}
 */
module.exports.startListeningForAdvertisementsWifi = function() {
  return Promise.resolve();
};

/**
 * This just calls {@link module:thaliWifiInfrastructure.stopListeningForAdvertisements}. See there for
 * definition of behavior.
 *
 * @returns {Promise<null|Error>}
 */
module.exports.stopListeningForAdvertisementsWifi = function() {
  return Promise.resolve();
};

/**
 * This just calls {@link module:thaliWifiInfrastructure.startUpdateAdvertisingAndListenForIncomingConnections}. See
 * there for definition of behavior.
 *
 * @param app An Express app handler
 * @returns {Promise<null|Error>}
 */
module.exports.startUpdateAdvertisingAndListenForIncomingConnections = function(app) {
  return Promise.resolve();
};

/**
 * This just calls {@link module:thaliWifiInfrastructure.stopAdvertisingAndListeningForIncomingConnections}. See there
 * for definition of behavior.
 *
 * @returns {Promise<null|Error>}
 */
module.exports.stopAdvertisingAndListeningForIncomingConnections = function() {
  return Promise.resolve();
};

/**
 * This will
 * @returns {*}
 */
module.exports.updateAdvertising = function() {
  return Promise.resolve();
};
