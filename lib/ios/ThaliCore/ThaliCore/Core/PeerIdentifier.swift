//
//  Thali CordovaPlugin
//  PeerIdentifier.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import Foundation
import MultipeerConnectivity

///Peer identifier with generations
public struct PeerIdentifier: Hashable {

    // MARK: - Public state
    public let uuid: String
    public let generation: Int

    public var hashValue: Int {
        return stringValue.hashValue
    }

    // MARK: - Internal state
    internal var stringValue: String {
        return "\(uuid)\(PeerIdentifier.separator)\(String(generation, radix: 16))"
    }

    // MARK: - Private state
    private static let separator: Character = ":"

    // MARK: - Public methods
    public init() {
        uuid = NSUUID().UUIDString
        generation = 0
    }

    init(uuidIdentifier: String, generation: Int) {
        self.uuid = uuidIdentifier
        self.generation = generation
    }

    public init(stringValue: String) throws {
        let parts = stringValue.characters
                    .split { $0 == PeerIdentifier.separator }
                    .map(String.init)
        guard parts.count == 2 else {
            throw ThaliCoreError.IllegalPeerID
        }
        guard let generation = Int(parts[1], radix: 16) else {
            throw ThaliCoreError.IllegalPeerID
        }
        self.uuid = parts[0]
        self.generation = generation
    }

    func nextGenerationPeer() -> PeerIdentifier {
        return PeerIdentifier(uuidIdentifier: uuid, generation: generation + 1)
    }
}

// MARK: - Multipeer connectivity specific functions
extension PeerIdentifier {

    init(peerID peer: MCPeerID) throws {
        try self.init(stringValue: peer.displayName)
    }
}

// MARK: - Multipeer connectivity specific functions
extension MCPeerID {

    convenience init(peerIdentifier: PeerIdentifier) {
        self.init(displayName: peerIdentifier.stringValue)
    }
}

public func == (lhs: PeerIdentifier, rhs: PeerIdentifier) -> Bool {
    return lhs.stringValue.compare(rhs.stringValue, options: .LiteralSearch) == .OrderedSame
}
