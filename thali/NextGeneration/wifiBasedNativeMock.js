"use strict";

var Promise = require("lie");
var ThaliWifiInfrastructure = require("ThaliWifiInfrastructure");


/** @module WifiBasedNativeMock */

/**
 * @file
 *
 * This is a mock of {@link module:thaliMobileNative}. It is intended to replicate all the capabilities of
 * {@link module:thaliMobileNative} so that we can build and test code intended to use {@link module:thaliMobileNative}
 * on the desktop.
 *
 * We are intentionally replicating the lowest layer of the stack in order to to be able to test on the desktop
 * all the layers on top of it.
 */

MobileCallInstance.prototype.wifiBasedNativeMock = null;
MobileCallInstance.prototype.mobileName = null;

/**
 * In effect this listens for SSDP:alive and SSDP:byebye messages along with the use of SSDP queries to find out who is
 * around. These will be translated to peer availability callbacks as specified below. This code MUST meet the  same
 * requirements for using a unique SSDP port, syntax for requests, etc. as {@link module:ThaliWifiInfrastructure}.
 *
 * Other requirements for this method MUST match those of
 * {@link external:"Mobile('StartListeningForAdvertisements')".callNative} in terms of idempotency.
 *
 * This method MUST validate that it received a proper callback object or it MUST throw an exception.
 *
 * @public
 * @param {module:thaliMobileNative~ThaliMobileCallback} callBack
 * @returns {null}
 * @constructor
 */
MobileCallInstance.prototype.StartListeningForAdvertisements = function(callBack) {
  return null;
};

/**
 * This shuts down the SSDP listener/query code. It MUST also validate that it received a proper callback object or it
 * MUST throw an exception and MUST otherwise behave as given for
 * {@link external:"Mobile('StopListeningForAdvertisements')".callNative}.
 *
 * @public
 * @param {module:thaliMobileNative~ThaliMobileCallback} callBack
 * @returns {null}
 * @constructor
 */
MobileCallInstance.prototype.StopListeningForAdvertisements = function(callBack) {
  return null;
};

/**
 * This method tells the system to both start advertising and to accept incoming connections. In both cases we need
 * to accept incoming connections. The main challenge is simulating what happens when stop is called. This is supposed
 * to shut down all incoming connections. So we can't just advertise our 127.0.0.1 port and let the other mocks
 * running on the same machine connect since stop wouldn't behave properly. We also need to simulate the Bluetooth
 * handshake in the case of simulating Android. Or do we? Need to think if that is worth worrying about.
 *
 * Do we think we can just use a reverse HTTPS proxy? I don't know if it will work since we aren't using HTTP at all
 * at this layer and even HTTPS proxies can expect some HTTPS looking behavior. What we are really proxying is a TcP
 * connection. I did find an old, incomplete project that does this. It's not exactly brain surgery. I suspect we should
 * just write our own super simple TCP proxy. It accepts an incoming connection, creates an outgoing connection to the
 * port we were passed in and that is it. We can use pipe to connect the TCP sockets. We just need to catch the close
 * event to make sure we shut down the other half of the pipe. In fact, I think that might work automatically when
 * we pipe links of the same type together.
 *
 * START HERE!!!
 *
 * For now we will keep things super simple and just advertise the port number we will
 * be giving which will be a 127.0.0.1 port. This means that when we set the location in SSDP messages we need to
 * specify a "http://127.0.0.1:x" style address.
 *
 * For advertising we will use SSDP both to make SSDP:alive as well as to answer queries as given in
 * {@link module:ThaliWifiInfrastructure}.
 *
 * For incoming connections we will, as described above, just rely on everyone running on 127.0.0.1.
 *
 * This function MUST validate that it received a proper portNumber and callBack or it MUST throw an exception.
 *
 * Otherwise the behavior MUST be the same as defined for
 * (@link external:"Mobile('StartUpdateAdvertisingAndListenForIncomingConnections')".callNative}.
 *
 * @param {number} portNumber
 * @param {module:thaliMobileNative~ThaliMobileCallback} callBack
 * @returns {null}
 * @constructor
 */
MobileCallInstance.prototype.StartUpdateAdvertisingAndListenForIncomingConnections = function(portNumber, callBack) {
  return null;
};

/**
 * This function MUST behave like {@link module:ThaliWifiInfrastructure} and send a proper SSDP:byebye and then
 * stop responding to queries or sending SSDP:alive messages. It also MUST validate that it got a proper callback
 * or it must throw an exception. Otherwise it MUST act like
 * (@link external:"Mobile('StopUpdateAdvertisingAndListenForIncomingConnections')".callNative}.
 *
 * @param {module:thaliMobileNative~ThaliMobileCallback} callBack
 * @returns {null}
 * @constructor
 */
MobileCallInstance.prototype.StopAdvertisingAndListeningForIncomingConnections = function(callBack) {
  return null;
};

/**
 *
 * @returns {null}
 */
MobileCallInstance.prototype.callNative = function() {
  switch (this.mobileName) {
    case "StartListeningForAdvertisements":
        return this.StartListeningForAdvertisements(arguments[0]);
    case "StopListeningForAdvertisements":
        return this.StopListeningForAdvertisements(arguments[0]);
    case "StartUpdateAdvertisingAndListenForIncomingConnections":
        return this.StartUpdateAdvertisingAndListenForIncomingConnections(arguments[0], arguments[1]);
    default:
        throw new Error("Unrecognized mobile name: " + this.mobileName);
  }
};

function MobileCallInstance(name, wifiBasedNativeMock) {
  this.mobileName = name;
  this.wifiBasedNativeMock = wifiBasedNativeMock;
}

/**
 * To use this mock save the current global object Mobile (if it exists) and replace it with this object. In general
 * this object won't exist on the desktop.
 *
 * @public
 * @constructor
 */
function WifiBasedNativeMock() {
  var thaliWifiInfrastructure = new ThaliWifiInfrastructure();
  return function(name) {
    return new MobileCallInstance(name, thaliWifiInfrastructure);
  }
}

module.exports = WifiBasedNativeMock;
