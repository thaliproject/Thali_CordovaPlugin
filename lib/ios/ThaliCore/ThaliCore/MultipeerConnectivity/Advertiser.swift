//
//  Thali CordovaPlugin
//  Advertiser.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import MultipeerConnectivity

/**
 The `Advertiser` class manages underlying `MCNearbyServiceAdvertiser` object
 and handles `MCNearbyServiceAdvertiserDelegate` events
 */
final class Advertiser: NSObject {

  // MARK: - Internal state

  /**
   Bool flag indicates if `Advertiser` object is advertising.
   */
  internal fileprivate(set) var advertising: Bool = false

  /**
   `Advertiser`'s *Peer* object.
   */
  internal let peer: Peer

  // MARK: - Private state

  /**
   MCNearbyServiceAdvertiser object.
   */
  fileprivate let advertiser: MCNearbyServiceAdvertiser

  /**
   Handle receiving invitation.
   */
  fileprivate let didReceiveInvitationHandler: (_ session: Session) -> Void

  /**
   Handle disconnecting session.
   */
  fileprivate let didDisconnectHandler: () -> Void

  /**
   Handle failing advertisement.
   */
  fileprivate var startAdvertisingErrorHandler: ((Error) -> Void)? = nil

  // MARK: - Initialization

  /**
   Returns a new `Advertiser` object or nil if it could not be created.

   - parameters:
     - peer:
       `Peer` object.

     - serviceType:
       The type of service to advertise.
       This should be a string in the format of Bonjour service type:
       1. *Must* be 1–15 characters long
       2. Can contain *only* ASCII letters, digits, and hyphens.
       3. *Must* contain at least one ASCII letter
       4. *Must* not begin or end with a hyphen
       5. Hyphens must not be adjacent to other hyphens

       For more details, see [RFC6335](https://tools.ietf.org/html/rfc6335#section-5.1).

     - receivedInvitation:
       Called when an invitation to join a MCSession is received from a nearby peer.

     - sessionNotConnected:
       Called when the nearby is not (or is no longer) in this session.

   - returns:
     An initialized `Advertiser` object, or nil if an object could not be created
     due to invalid `serviceType` format.
   */
  required init?(peer: Peer,
                 serviceType: String,
                 receivedInvitation: @escaping (_ session: Session) -> Void,
                 sessionNotConnected: @escaping () -> Void) {

    guard String.isValidServiceType(serviceType) else {
      return nil
    }

    let advertiser = MCNearbyServiceAdvertiser(peer: MCPeerID(peer: peer),
                                               discoveryInfo: nil,
                                               serviceType: serviceType)
    self.advertiser = advertiser
    self.peer = peer
    self.didReceiveInvitationHandler = receivedInvitation
    self.didDisconnectHandler = sessionNotConnected
    super.init()
  }

  // MARK: - Internal methods

  /**
   Begins advertising the `serviceType` provided in init method.

   This method sets `advertising` value to `true`.
   It does not change state if `Advertiser` is already advertising.

   - parameters:
     - startAdvertisingErrorHandler:
       Called when advertisement fails.
   */
  func startAdvertising(_ startAdvertisingErrorHandler: @escaping (Error) -> Void) {
    if !advertising {
      self.startAdvertisingErrorHandler = startAdvertisingErrorHandler
      advertiser.delegate = self
      advertiser.startAdvertisingPeer()
      advertising = true
    }
  }

  /**
   Stops advertising the `serviceType` provided in init method.

   This method sets `advertising` value to `false`.
   It does not change state if `Advertiser` is already not advertising.
   */
  func stopAdvertising() {
    if advertising {
      advertiser.delegate = nil
      advertiser.stopAdvertisingPeer()
      advertising = false
    }
  }
}

// MARK: - MCNearbyServiceAdvertiserDelegate
extension Advertiser: MCNearbyServiceAdvertiserDelegate {

  func advertiser(_ advertiser: MCNearbyServiceAdvertiser,
                  didReceiveInvitationFromPeer peerID: MCPeerID,
                  withContext context: Data?,
                  invitationHandler: @escaping (Bool, MCSession?) -> Void) {

    let mcSession = MCSession(peer: advertiser.myPeerID,
                              securityIdentity: nil,
                              encryptionPreference: .none)

    let session = Session(session: mcSession,
                          identifier: peerID,
                          connected: {},
                          notConnected: didDisconnectHandler)

    invitationHandler(true, mcSession)
    didReceiveInvitationHandler(session)
    // TODO: https://github.com/thaliproject/Thali_CordovaPlugin/issues/1040
  }

  func advertiser(_ advertiser: MCNearbyServiceAdvertiser,
                  didNotStartAdvertisingPeer error: Error) {
    stopAdvertising()
    startAdvertisingErrorHandler?(error)
  }
}
