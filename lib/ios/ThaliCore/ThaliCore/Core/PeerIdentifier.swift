//
//  Thali CordovaPlugin
//  PeerIdentifier.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation
import MultipeerConnectivity

public enum PeerIdentifierError: String, ErrorType {
    case IllegalPeerID
}

///Peer identifier with generations
public struct PeerIdentifier: Hashable {
    public let uuid: String
    let generation: Int

    init() {
        uuid = NSUUID().UUIDString
        generation = 0
    }

    init(uuidIdentifier: String, generation: Int) {
        self.uuid = uuidIdentifier
        self.generation = generation
    }

    public init(stringValue: String) throws {
        let parts = stringValue.characters.split {
             $0 == ":"
             }.map(String.init)
        guard parts.count == 2 else {
            throw PeerIdentifierError.IllegalPeerID
        }
        guard let generation = Int(parts[1], radix: 16) else {
            throw PeerIdentifierError.IllegalPeerID
        }
        self.uuid = parts[0]
        self.generation = generation
    }

    func nextGenerationPeer() -> PeerIdentifier {
        return PeerIdentifier(uuidIdentifier: uuid, generation: generation + 1)
    }

    var stringValue: String {
        return "\(uuid):\(String(generation, radix: 16))"
    }

    public var hashValue: Int {
        return stringValue.hashValue
    }
}

///Multipeer connectivity specific functions
extension PeerIdentifier {

    init(mcPeer peer: MCPeerID) throws {
        try self.init(stringValue: peer.displayName)
    }
}

extension MCPeerID {
    convenience init(peerIdentifier: PeerIdentifier) {
        self.init(displayName: peerIdentifier.stringValue)
    }
}

public func == (lhs: PeerIdentifier, rhs: PeerIdentifier) -> Bool {
    let lhsString = lhs.stringValue
    let rhsString = rhs.stringValue
    guard lhsString.characters.count == rhsString.characters.count else {
        return false
    }
    var lhsIndex = lhsString.characters.startIndex
    var rhsIndex = lhsString.characters.startIndex
    while lhsIndex < lhsString.endIndex && rhsIndex < rhsString.endIndex {
        guard lhsString.characters[lhsIndex] == rhsString.characters[rhsIndex] else {
            return false
        }
        lhsIndex = lhsIndex.successor()
        rhsIndex = rhsIndex.successor()
    }
    return true
}
