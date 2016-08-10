//
//  Thali CordovaPlugin
//  Browser.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation
import MultipeerConnectivity

protocol BrowserDelegate: class {
    func browser(browser: Browser, didFindPeer peer: String)
    func browser(browser: Browser, didLosePeer peer: String)
}

final class Browser: NSObject {
    private let browser: MCNearbyServiceBrowser
    private var activeSessions: [SessionManager] = []
    private let canConnectToPeer: (PeerIdentifier) -> Bool
    private let foundPeerWithIdentifier: (PeerIdentifier) -> Void

    let peerIdentifier: PeerIdentifier
    internal private(set) var isListening: Bool = false
    weak var delegate: BrowserDelegate?

    required init(peerIdentifier: PeerIdentifier, serviceType: String, canConnectToPeer: (PeerIdentifier) -> Bool, foundPeerWithIdentifier: (PeerIdentifier) -> Void) {
        browser = MCNearbyServiceBrowser(peer: peerIdentifier.mcPeer, serviceType: serviceType)
        self.peerIdentifier = peerIdentifier
        self.canConnectToPeer = canConnectToPeer
        self.foundPeerWithIdentifier = foundPeerWithIdentifier
        super.init()
        browser.delegate = self
    }

    func connectToPeer(withIdentifier identifier: PeerIdentifier, port: UInt16) {
        if canConnectToPeer(peerIdentifier) {
            let session = SessionManager(peer: identifier.mcPeer)
            session.connectToPort(port)
        }
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
            foundPeerWithIdentifier(peerIdentifier)
        } catch let error {
            print("cannot connect to peer \"\(peerID.displayName)\" because of error: \(error)")
        }
    }

    func browser(browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        delegate?.browser(self, didLosePeer: peerID.displayName)
    }

    func browser(browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: NSError) {
        isListening = false
        print("didNotStartingBrowsingForPeers")
    }
}
