'use strict';

/** @module thaliPeerPoolInterface */

/**
 * Interface for a class that can manage communications with remote peers.
 *
 *
 * @interface ThaliPeerPoolInterface
 */

/**
 * This callback is called by the {@link module:PeerPolManager~enqueueCallback}
 * when it has finished its task and no longer needs to communicate with the
 * remote peer. Note that in cases that the connection to the remote peer
 * is lost and retries don't work then its critical to call this callback.
 *
 * @callback ThaliPeerPoolInterface~FinishedEnqueueCallback
 */

/**
 * This callback is called when the pool manager wants to honor the request
 * to communicate with the specified peer.
 *
 * @callback EnqueueCallback
 * @param {http.Agent} httpAgentPool HELLO The HTTP client connection pool to use
 * when making requests to the requested peer.
 * @param {ThaliPeerPoolInterface~FinishedEnqueueCallback} finishedEnqueueCallback This callback is to be called once the action is
 * completed.
 */

/**
 * Adds a request to establish a connection to the specified peerIdentifier
 * over the specified connection type for the purpose of the specified
 * action type.
 *
 * Once the peer manager decides this request should be granted it will call
 * the enqueueCallback.
 *
 * If enqueue is called with an unacceptable peerIdentifier, an unrecognized
 * connectionType or an unsupported actionType then the function MUST return
 * an Error object. Otherwise it MUST return null.
 *
 * There is no guarantee that enqueueCallback will ever be called. The callback
 * could just be discarded.
 *
 * @function
 * @name module:thaliPeerPoolInterface~ThaliPeerPoolInterface#enqueue
 * @param {string} peerIdentifier
 * @param {module:thaliMobile.connectionTypes} connectionType
 * @param {string} actionType
 * @param {EnqueueCallback} enqueueCallback
 * @returns {?Error}
 */
