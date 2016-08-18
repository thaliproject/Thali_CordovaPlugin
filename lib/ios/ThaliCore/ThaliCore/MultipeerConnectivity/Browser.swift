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
    internal private(set) var isListening: Bool = false {
        didSet {
            listeningStateChanged?(isListening)
        }
    }

    required init(serviceType: String,
                  foundPeer: (PeerIdentifier) -> Void,
                  lostPeer: (PeerIdentifier) -> Void) {
        let peerId = MCPeerID(displayName: NSUUID().UUIDString)
        browser = MCNearbyServiceBrowser(peer: peerId, serviceType: serviceType)

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

    /**
     transforms PeerIdentifier to MCPeerID and invites it to MCSession

     - parameter peerIdentifier: peer identifier to invite

     - returns: Session object for managing multipeer session between devices
     */
    func invitePeerToConnect(peerIdentifier: PeerIdentifier) -> Session {
        let mcSession = MCSession(peer: browser.myPeerID, securityIdentity: nil, encryptionPreference: .None)
        let session = Session(session: mcSession, identifier: peerIdentifier.stringValue)
        browser.invitePeer(peerIdentifier.mcPeer, toSession: mcSession, withContext: nil, timeout: 30)
        return session
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
