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
    private let didFindPeer: (PeerIdentifier) -> Void
    private let didLosePeer: (PeerIdentifier) -> Void
    var didChangeListeningHandler: ((Bool) -> Void)?
    internal private(set) var listening: Bool = false {
        didSet {
            didChangeListeningHandler?(listening)
        }
    }

    required init(serviceType: String,
                  foundPeer: (PeerIdentifier) -> Void,
                  lostPeer: (PeerIdentifier) -> Void) {
        browser = MCNearbyServiceBrowser(peer: MCPeerID(displayName: NSUUID().UUIDString), serviceType: serviceType)
        self.didFindPeer = foundPeer
        self.didLosePeer = lostPeer
        super.init()
        browser.delegate = self
    }

    func startListening() {
        browser.startBrowsingForPeers()
        listening = true
    }

    func stopListening() {
        listening = false
    }
}

extension Browser: MCNearbyServiceBrowserDelegate {

    func browser(browser: MCNearbyServiceBrowser,
                        foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String : String]?) {
        do {
            let peerIdentifier = try PeerIdentifier(mcPeer: peerID)
            didFindPeer(peerIdentifier)
        } catch let error {
            print("cannot parse identifier \"\(peerID.displayName)\" because of error: \(error)")
        }
    }

    func browser(browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        do {
            let peerIdentifier = try PeerIdentifier(mcPeer: peerID)
            didLosePeer(peerIdentifier)
        } catch let error {
            print("cannot parse identifier \"\(peerID.displayName)\" because of error: \(error)")
        }
    }

    func browser(browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: NSError) {
        listening = false
        print("didNotStartingBrowsingForPeers \(error)")
    }
}
