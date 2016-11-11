//
//  Thali CordovaPlugin
//  PeerAvailability.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

public struct PeerAvailability {

  public let peerIdentifier: String
  public let generation: Int
  public let available: Bool

  public init(peer: Peer, available: Bool) {
    self.peerIdentifier = peer.uuid
    self.generation = peer.generation
    self.available = available
  }
}
