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

  /**
   An opaque value that identifies a non-TCP/IP transport handle for the peer.
   This value must map to the UUID part of the MCPeerID.
   */
  public let uuid: String

  /**
   An integer which counts changes in the peer's database.
   */
  public fileprivate(set) var generation: Int

  /**
   Hash value from *stringValue* which represents uuid and generation.
   */
  public var hashValue: Int {
    return stringValue.hashValue
  }

  // MARK: - Internal state

  /**
   Combination of *uuid* and *generation* separated by *separator*.
   */
  internal var stringValue: String {
    return "\(uuid)" + "\(Peer.separator)" + "\(String(generation, radix: 16))"
  }

  // MARK: - Private state
  /**
   Symbol that is used to separate *uuid* and *generation* in *stringValue*.
   */
  fileprivate static let separator: Character = ":"

  // MARK: - Public methods

  public init() {
    uuid = UUID().uuidString
    generation = 0
  }

  /**
   Returns a new `Peer` object.

   - parameters:
     - uuidIdentifier:
       String that identifies a non-TCP/IP transport handle for the new `Peer`.
       This value must map to the UUID part of the MCPeerID.

     - generation:
       An integer which counts changes in the peer's database.

   - throws:
     IllegalPeerID error if uuidIdentifier is invalid string.

   - returns: An initialized `Peer` object.
   */
  public init(uuidIdentifier: String, generation: Int) throws {
    guard let _ = UUID(uuidString: uuidIdentifier) else {
      throw ThaliCoreError.IllegalPeerID
    }
    self.uuid = uuidIdentifier
    self.generation = generation
  }

  /**
   Returns a new `Peer` object.

   - parameters:
     - stringValue:
       String that represents combination of *uuid* and *generation* separated by *separator*.

   - throws:
     IllegalPeerID error in following cases:
       * *stringValue* doesn't have separator, or have more than one
       * uuid part in *stringValue* is invalid string
       * generation part in *stringValue* is not hex-number

   - returns: An initialized `Peer` object.
   */
  public init(stringValue: String) throws {
    let peerParts = stringValue.characters
                    .split { $0 == Peer.separator }
                    .map(String.init)
    guard peerParts.count == 2 else {
      throw ThaliCoreError.IllegalPeerID
    }
    guard let uuid = UUID(uuidString: peerParts[0]) else {
      throw ThaliCoreError.IllegalPeerID
    }
    guard let generation = Int(peerParts[1], radix: 16) else {
      throw ThaliCoreError.IllegalPeerID
    }
    self.uuid = uuid.uuidString
    self.generation = generation
  }

  // MARK: - Internal methods

  /**
   Returns `Peer` object with *generation* incremented by 1.
   */
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

// MARK: - Overloading equivalence (==) operator
public func == (lhs: Peer, rhs: Peer) -> Bool {
  return lhs.stringValue.compare(rhs.stringValue, options: .literal) == .orderedSame
}
