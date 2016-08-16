//
//  Thali CordovaPlugin
//  Browser.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation
import MultipeerConnectivity

final class Browser: NSObject {
    private let browser: MCNearbyServiceBrowser
    private let foundPeer: (PeerIdentifier) -> Void
    private let lostPeer: (PeerIdentifier) -> Void
    var listeningStateChanged: ((Bool) -> Void)?

    let peerIdentifier: PeerIdentifier
    internal private(set) var isListening: Bool = false {
        didSet {
            listeningStateChanged?(isListening)
        }
    }

    required init(peerIdentifier: PeerIdentifier, serviceType: String,
                  foundPeer: (PeerIdentifier) -> Void,
                  lostPeer: (PeerIdentifier) -> Void) {
        browser = MCNearbyServiceBrowser(peer: peerIdentifier.mcPeer, serviceType: serviceType)
        self.peerIdentifier = peerIdentifier
        self.foundPeer = foundPeer
        self.lostPeer = lostPeer
        super.init()
        browser.delegate = self
    }

    func startListening() {
        browser.startBrowsingForPeers()
        isListening = true
    }

    func stopListening() {
        isListening = false
    }
}

extension Browser: MCNearbyServiceBrowserDelegate {

    func browser(browser: MCNearbyServiceBrowser,
                        foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String : String]?) {
        do {
            let peerIdentifier = try PeerIdentifier(mcPeer: peerID)
            foundPeer(peerIdentifier)
        } catch let error {
            print("cannot parse identifier \"\(peerID.displayName)\" because of error: \(error)")
        }
    }

    func browser(browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        do {
            let peerIdentifier = try PeerIdentifier(mcPeer: peerID)
            lostPeer(peerIdentifier)
        } catch let error {
            print("cannot parse identifier \"\(peerID.displayName)\" because of error: \(error)")
        }
    }

    func browser(browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: NSError) {
        isListening = false
        print("didNotStartingBrowsingForPeers \(error)")
    }
}
