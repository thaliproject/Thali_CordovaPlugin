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
 */

/**
 * @file
 *
 * This is the primary interface for those who want to perform local discovery of devices over all possible
 * connection mediums including Wi-Fi infrastructure mode as well as whatever P2P radio mechanisms (BLE, Bluetooth,
 * etc.) that the device supports.
 */


/**
 * This will start listening for other peers both on Wi-Fi Infrastructure Mode and using whatever local non-TCP/IP
 * P2P mechanisms supported by the device.
 *
 * If the Thali code expects the device's platform to support a particular
 * non-TCP/IP P2P mechanism (e.g. we expect Android devices to support BLE and Bluetooth) and if the necessary
 * radios are not present or not turned on than an error MUST be returned. If Thali can't find a WiFi radio or
 * the radio is turned off on a platform that has functioning non-TCP/IP P2P then an error MUST NOT be returned.
 *
 *
 *
 * @returns {}
 */
module.exports.startListeningForAdvertisements = function() {
  return Promise.resolve();
};
