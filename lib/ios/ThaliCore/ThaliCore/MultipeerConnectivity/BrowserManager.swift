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
    private var currentBrowser: Browser?
    let serviceType: String
    public var peersAvailabilityChanged: (([PeerAvailability]) -> Void)? = nil

    public init(serviceType: String) {
        self.serviceType = serviceType
    }

    private func canConnectToPeer(identifier: PeerIdentifier) -> Bool {
        return true
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
                canConnectToPeer: canConnectToPeer, foundPeer: foundPeer, lostPeer: lostPeer)
        browser.startListening()
        self.currentBrowser = browser
    }

    public func stopListeningForAdvertisements() {
        guard let currentBrowser = self.currentBrowser where currentBrowser.isListening else {
            assert(false, "there is no active listener")
            return
        }
        currentBrowser.stopListening()
    }

    public func connectToPeer(identifier: PeerIdentifier, withPort port: UInt16) {
        guard let currentBrowser = self.currentBrowser where currentBrowser.isListening else {
            assert(false, "there is no active listener")
            return
        }
        currentBrowser.connectToPeer(withIdentifier: identifier, port: port)
    }
}
