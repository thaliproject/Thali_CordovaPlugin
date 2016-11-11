//
//  Thali CordovaPlugin
//  Peer.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import MultipeerConnectivity

/// This object defines information about a single peer.
public struct Peer: Hashable {

  // MARK: - Public state
  /// An opaque value that identifies a non-TCP/IP transport handle for the peer.
  /// This value must map to the UUID part of the MCPeerID.
  public let uuid: String

  /// An integer which counts changes in the peer's database.
  public private(set) var generation: Int

  public var hashValue: Int {
    return stringValue.hashValue
  }

  // MARK: - Internal state
  /// Combination of `uuid` and `generation` in format *uuid:generation*
  internal var stringValue: String {
    return "\(uuid)\(Peer.separator)\(String(generation, radix: 16))"
  }

  // MARK: - Private state
  private static let separator: Character = ":"

  // MARK: - Public methods
  public init() {
    uuid = NSUUID().UUIDString
    generation = 0
  }

  public init(uuidIdentifier: String, generation: Int) throws {
    guard let _ = NSUUID(UUIDString: uuidIdentifier) else {
      throw ThaliCoreError.IllegalPeerID
    }
    self.uuid = uuidIdentifier
    self.generation = generation
  }

  public init(stringValue: String) throws {
    let peerParts = stringValue.characters
      .split { $0 == Peer.separator }
      .map(String.init)
    guard peerParts.count == 2 else {
      throw ThaliCoreError.IllegalPeerID
    }
    guard let uuid = NSUUID(UUIDString: peerParts[0]) else {
      throw ThaliCoreError.IllegalPeerID
    }
    guard let generation = Int(peerParts[1], radix: 16) else {
      throw ThaliCoreError.IllegalPeerID
    }
    self.uuid = uuid.UUIDString
    self.generation = generation
  }

  func nextGenerationPeer() -> Peer {
    var peer = self
    peer.generation += 1
    return peer
  }
}

// MARK: - Multipeer connectivity specific functions
extension Peer {

  init(mcPeerID peer: MCPeerID) throws {
    try self.init(stringValue: peer.displayName)
  }
}

// MARK: - Multipeer connectivity specific functions
extension MCPeerID {

  convenience init(peer: Peer) {
    self.init(displayName: peer.stringValue)
  }
}

public func == (lhs: Peer, rhs: Peer) -> Bool {
  return lhs.stringValue.compare(rhs.stringValue, options: .LiteralSearch) == .OrderedSame
}
