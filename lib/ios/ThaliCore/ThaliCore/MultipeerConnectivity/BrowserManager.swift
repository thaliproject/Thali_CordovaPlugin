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
    public var isListening: Bool {
        return currentBrowser?.isListening ?? false
    }

    public init(serviceType: String) {
        self.serviceType = serviceType
    }

    private func foundPeer(withIdentifier identifier: PeerIdentifier) {
        peersAvailabilityChanged?([PeerAvailability(peerIdentifier: identifier, available: true)])
    }

    private func lostPeer(withIdentifier identifier: PeerIdentifier) {
        peersAvailabilityChanged?([PeerAvailability(peerIdentifier: identifier, available: false)])
    }

    public func startListeningForAdvertisements() {
        if let currentBrowser = currentBrowser {
            currentBrowser.stopListening()
        }
        let browser = Browser(peerIdentifier: PeerIdentifier(), serviceType: serviceType,
                              foundPeer: foundPeer, lostPeer: lostPeer)
        browser.startListening()
        self.currentBrowser = browser
    }

    public func stopListeningForAdvertisements() {
        guard let currentBrowser = self.currentBrowser where currentBrowser.isListening else {
            assert(false, "there is no active listener")
            return
        }
        currentBrowser.stopListening()
        self.currentBrowser = nil
    }
}
