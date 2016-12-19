//
//  Thali CordovaPlugin
//  PeerAvailability.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

public struct PeerAvailability {

  // MARK: - Public state

  /**
   An opaque value that identifies a non-TCP/IP transport handle for the discovered peer.
   */
  public let peerIdentifier: String

  /**
   An integer which counts changes in the peer's database.
   */
  public let generation: Int

  /**
   If true this indicates that the peer is available for connectivity.
   If false it means that the peer can no longer be connected to.
   */
  public let available: Bool

  // MARK: - Public methods

  /**
   Returns a new `PeerAvailability` object.

   - parameters:
     - peer:
       Defines information about a single peer.

     - available:
       Bool value that indicates that the peer is available for connectivity.

   - returns: An initialized `PeerAvailability` object.
   */
  public init(peer: Peer, available: Bool) {
    self.peerIdentifier = peer.uuid
    self.generation = peer.generation
    self.available = available
  }
}
