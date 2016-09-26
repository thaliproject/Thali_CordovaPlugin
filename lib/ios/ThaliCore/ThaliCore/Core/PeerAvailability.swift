//
//  Thali CordovaPlugin
//  PeerAvailability.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import Foundation

public struct PeerAvailability {

    public let peerIdentifier: String
    public let generation: Int
    public let available: Bool

    public init(peerIdentifier: PeerIdentifier, available: Bool) {
        self.peerIdentifier = peerIdentifier.uuid
        self.generation = peerIdentifier.generation
        self.available = available
    }
}
