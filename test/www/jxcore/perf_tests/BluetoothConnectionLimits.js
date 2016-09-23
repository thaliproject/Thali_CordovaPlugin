'use strict';

var events = require('events');
var ThaliEmitter = require('thali/thaliemitter');

/** @module BluetoothConnectionLimits */

/**
 * @file
 *
 * The problem we face is that we fundamentally don't know how the heck Bluetooth actually works on Android phones.
 * By way of background Bluetooth is based on something called a piconet. A piconet consists of a boss with up to 7
 * workers. Bluetooth is a time division multiplexing protocol and all the devices in the same piconet use the boss's
 * clock to decide how to grab time slots and the boss tells the workers when they are allowed to speak. To complicate
 * matters further there can actually be up to 256 devices in a piconet but beyond those 8 the rest have to be
 * inactive. This means in effective they are asleep. The boss is allowed to wake up devices but if they are at
 * the maximum of 7 active devices then they have to move an active device to being inactive.
 *
 * A single device can be boss on exactly one piconet but it can be a worker on a theoretically unlimited number of
 * piconets. In practice however the probability of message collisions go up the more devices and piconets there are
 * so at some point the density of devices would get high enough to seriously interfere with communications.
 *
 * So here is what we don't know:
 * - When device A and device B establish an insecure RFCOMM connection how do they decide what piconet to use?
 * - If device A already has a connection with device B and then device B establishes a connection with device A does
 * this go over the existing insecure RFCOMM connection or is a new connection created? If a new connection is created
 * does it go over the existing piconet or on a new piconet?
 * - How many piconets can a device support being a worker on?
 *
 * We can boil this down to a set of specific questions we need answers to:
 * 1. How many simultaneous incoming connections can we support?
 * 2. How many simultaneous outgoing connections can we support?
 * 3. Are the answers to questions 1 and 2 related, that is, is the right question "how many connections of any type
 * can we simultaneously support"?
 * 4. If we allow a connection to go quiet will it become an inactive connection and affect the answers to questions
 * 1-3?
 * 5. Are the answers to questions 1-3 different depending on the hardware and OS we are using on the devices?
 */

/**
 * This function will determine for a device what is the maximum number of simultaneous active incoming connections
 * each of the devices in the test can handle.
 */
function testMaxIncomingActiveConnections() {

}
