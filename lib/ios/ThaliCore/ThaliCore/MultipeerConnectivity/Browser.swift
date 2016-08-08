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

final class Browser: NSObject, MultipeerService {
    weak var delegate: BrowserDelegate?
    private let browser: MCNearbyServiceBrowser
    let peerIdentifier: PeerIdentifier

    required init(peerIdentifier: PeerIdentifier, serviceType: String) {
        browser = MCNearbyServiceBrowser(peer: peerIdentifier.mcPeer, serviceType: serviceType)
        self.peerIdentifier = peerIdentifier
        super.init()
        browser.delegate = self
    }
    
    func start() {
    }
    
    func stop() {
    }
}

extension Browser: MCNearbyServiceBrowserDelegate {

    func browser(browser: MCNearbyServiceBrowser,
                        foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String : String]?) {
    }

    func browser(browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        delegate?.browser(self, didLosePeer: peerID.displayName)
    }

    func browser(browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: NSError) {
        print("didNotStartingBrowsingForPeers")
    }
}
