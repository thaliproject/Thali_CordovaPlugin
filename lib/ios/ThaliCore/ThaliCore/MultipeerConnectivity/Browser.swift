//
//  Thali CordovaPlugin
//  Browser.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation
import MultipeerConnectivity

public protocol BrowserDelegate: class {
    func browser(browser: Browser, didFindPeer peer: String)
    func browser(browser: Browser, didLosePeer peer: String)
}

final public class Browser: NSObject, MultipeerService {
    public weak var delegate: BrowserDelegate?
    private let browser: MCNearbyServiceBrowser
    public let peerIdentifier: PeerIdentifier

    required public init(peerIdentifier: PeerIdentifier, serviceType: String) {
        browser = MCNearbyServiceBrowser(peer: peerIdentifier.mcPeer, serviceType: serviceType)
        self.peerIdentifier = peerIdentifier
        super.init()
        browser.delegate = self
    }
    
    public func start() {
    }
    
    public func stop() {
    }
}

extension Browser: MCNearbyServiceBrowserDelegate {

    public func browser(browser: MCNearbyServiceBrowser,
                        foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String : String]?) {
    }

    public func browser(browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        delegate?.browser(self, didLosePeer: peerID.displayName)
    }

    public func browser(browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: NSError) {
        print("didNotStartingBrowsingForPeers")
    }
}
