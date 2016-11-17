'use strict';

/** @module thaliPeerConnectionInformation */

/**
 * @file
 *
 * Defines a PeerConnectionInformation class for use by
 * {@link module:thaliPeerDictionary}.
 */

/**
 * @classdesc Records information about how to connect to a peer
 * over a particular connectionType.
 *
 * @public
 * @constructor
 * @param {module:ThaliMobileNativeWrapper.connectionTypes} connectionType
 * @param {string} hostAddress
 * @param {number} portNumber
 * @param {number} suggestedTCPTimeout
 */
function PeerConnectionInformation(connectionType, hostAddress,
                                   portNumber, suggestedTCPTimeout) {
  this._connectionType = connectionType;
  this._hostAddress = hostAddress;
  this._portNumber = portNumber;
  this._suggestedTCPTimeout = suggestedTCPTimeout ||
    PeerConnectionInformation.DEFAULT_TCP_TIMEOUT;
}

/**
 * Returns peer's host address, either IP or DNS.
 *
 * @public
 * @return {string} peer's host address, either IP or DNS
 */
PeerConnectionInformation.prototype.getHostAddress = function () {
  return this._hostAddress;
};


/**
 * Returns port to use with the host address.
 *
 * @public
 * @return {number} port to use with the host address.
 */
PeerConnectionInformation.prototype.getPortNumber = function () {
  return this._portNumber;
};

/**
 * Returns TCP time out to use when establishing a TCP connection with the
 * peer.
 *
 * @public
 * @return {number} TCP time out
 */
PeerConnectionInformation.prototype.getSuggestedTCPTimeout = function () {
  return this._suggestedTCPTimeout;
};

/**
 * Returns the connection type that we use to communicate with the peer.
 *
 * @public
 * @return {module:ThaliMobileNativeWrapper.connectionTypes} TCP time out
 */
PeerConnectionInformation.prototype.getConnectionType = function () {
  return this._connectionType;
};

/**
 * This is default TCP timeout that is used if suggestedTCPTimeout is
 * not defined for the PeerConnectionInformation.
 * @type {number}
 * @readonly
 */
PeerConnectionInformation.DEFAULT_TCP_TIMEOUT = 2000;

module.exports = PeerConnectionInformation;
