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
    weak var delegate: BrowserDelegate?
    private let browser: MCNearbyServiceBrowser
    let peerIdentifier: PeerIdentifier
    private var activeSessions: [SessionManager] = []
    private let canConnectToPeer: (PeerIdentifier) -> Bool
    var isListening: Bool = false

    required init(peerIdentifier: PeerIdentifier, serviceType: String, canConnectToPeer: (PeerIdentifier) -> Bool) {
        browser = MCNearbyServiceBrowser(peer: peerIdentifier.mcPeer, serviceType: serviceType)
        self.peerIdentifier = peerIdentifier
        self.canConnectToPeer = canConnectToPeer
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
            let _ = try PeerIdentifier(mcPeer: peerID)
            //todo notify about peer connection
        } catch let error {
            print("cannot connect to peer \"\(peerID.displayName)\" because of error: \(error)")
        }
    }

    func browser(browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        delegate?.browser(self, didLosePeer: peerID.displayName)
    }

    func browser(browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: NSError) {
        print("didNotStartingBrowsingForPeers")
    }
}
