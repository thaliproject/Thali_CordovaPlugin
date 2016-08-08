//
//  Thali CordovaPlugin
//  BrowserManager.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation

//class for managing Thali browser's logic
@objc public class BrowserManager: NSObject {
    private var currentBrowser: Browser?
    let serviceType: String

    init(serviceType: String) {
        self.serviceType = serviceType
    }

    private func canConnectToPeer(identifier: PeerIdentifier) -> Bool {
        return true
    }

    public func startListeningForAdvertisements() {
        if let currentBrowser = currentBrowser {
            currentBrowser.stopListening()
        }
        let browser = Browser(peerIdentifier: PeerIdentifier(), serviceType: serviceType, canConnectToPeer: canConnectToPeer)
        browser.startListening()
        self.currentBrowser = browser
    }

    public func stopListeningForAdvertisements() {
        guard let currentBrowser = self.currentBrowser where currentBrowser.isListening else {
            assert(false, "there is no active listener")
        }
        currentBrowser.stopListening()
    }

    public func connectToPeer(identifier: PeerIdentifier, withPort port: UInt16) {
        guard let currentBrowser = self.currentBrowser where currentBrowser.isListening else {
            assert(false, "there is no active listener")
        }
        currentBrowser.connectToPeer(withIdentifier: identifier, port: port)
    }
}
