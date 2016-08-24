//
//  Thali CordovaPlugin
//  BrowserManager.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation

public struct PeerAvailability {
    public let peerIdentifier: PeerIdentifier
    public let available: Bool
}

//class for managing Thali browser's logic
public final class BrowserManager: NSObject {
    internal private (set) var currentBrowser: Browser?
    let serviceType: String
    public var peersAvailabilityChanged: (([PeerAvailability]) -> Void)? = nil
    internal private(set) var availablePeers: [PeerIdentifier] = []
    public var isListening: Bool {
        return currentBrowser?.listening ?? false
    }

    public init(serviceType: String) {
        self.serviceType = serviceType
    }

    private func foundPeer(with identifier: PeerIdentifier) {
        peersAvailabilityChanged?([PeerAvailability(peerIdentifier: identifier, available: true)])
        availablePeers.append(identifier)
    }

    private func lostPeer(with identifier: PeerIdentifier) {
        peersAvailabilityChanged?([PeerAvailability(peerIdentifier: identifier, available: false)])
        if let index = availablePeers.indexOf(identifier) {
            availablePeers.removeAtIndex(index)
        }
    }

    public func startListeningForAdvertisements() {
        if let currentBrowser = currentBrowser {
            currentBrowser.stopListening()
        }
        let browser = Browser(serviceType: serviceType,
                              foundPeer: foundPeer, lostPeer: lostPeer)
        browser.startListening()
        self.currentBrowser = browser
    }

    public func stopListeningForAdvertisements() {
        guard let currentBrowser = self.currentBrowser where currentBrowser.listening else {
            assert(false, "there is no active listener")
            return
        }
        currentBrowser.stopListening()
        self.currentBrowser = nil
    }

    func lastGenerationPeer(for identifier: PeerIdentifier) -> PeerIdentifier? {
        return availablePeers
            .filter {
                $0.uuid == identifier.uuid
            }
            .maxElement {
                $0.0.generation < $0.1.generation
        }
    }
}
