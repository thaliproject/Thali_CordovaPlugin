//
//  Thali CordovaPlugin
//  Browser.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license 
//  information.
//

import Foundation
import MultipeerConnectivity

final class Browser: NSObject {
    private let browser: MCNearbyServiceBrowser
    private let didFindPeerHandler: (PeerIdentifier) -> Void
    private let didLosePeerHandler: (PeerIdentifier) -> Void
    internal private(set) var listening: Bool = false
    private var availablePeers: Atomic<[PeerIdentifier: MCPeerID]> = Atomic([:])

    required init(serviceType: String,
                  foundPeer: (PeerIdentifier) -> Void,
                  lostPeer: (PeerIdentifier) -> Void) {
        let peerId = MCPeerID(displayName: NSUUID().UUIDString)
        browser = MCNearbyServiceBrowser(peer: peerId, serviceType: serviceType)
        self.didFindPeerHandler = foundPeer
        self.didLosePeerHandler = lostPeer
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

    /**
     invites PeerIdentifier to session

     - parameter peerIdentifier: peer identifier to invite

     - throws: IllegalPeerID

     - returns: Session object for managing multipeer session between devices
     */
    func inviteToConnectPeer(with peerIdentifier: PeerIdentifier,
                                  disconnectHandler: () -> Void) throws -> Session {
        let mcSession = MCSession(peer: browser.myPeerID, securityIdentity: nil,
                                  encryptionPreference: .None)
        let peer = availablePeers.withValue {
            $0[peerIdentifier]
        }
        guard let mcPeer = peer else {
            throw MultiConnectError.IllegalPeerID
        }
        let session = Session(session: mcSession, identifier: mcPeer,
                              disconnectHandler: disconnectHandler)
        browser.invitePeer(mcPeer, toSession: mcSession, withContext: nil, timeout: 30)
        return session
    }
}

extension Browser: MCNearbyServiceBrowserDelegate {

    func browser(browser: MCNearbyServiceBrowser,
                        foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String : String]?) {
        do {
            let peerIdentifier = try PeerIdentifier(peerID: peerID)
            availablePeers.modify {
                $0[peerIdentifier] = peerID
            }
            didFindPeerHandler(peerIdentifier)
        } catch let error {
            print("cannot parse identifier \"\(peerID.displayName)\" because of error: \(error)")
        }
    }

    func browser(browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        do {
            let peerIdentifier = try PeerIdentifier(peerID: peerID)
            availablePeers.modify {
                $0.removeValueForKey(peerIdentifier)
            }
            didLosePeerHandler(peerIdentifier)
        } catch let error {
            print("cannot parse identifier \"\(peerID.displayName)\" because of error: \(error)")
        }
    }

    func browser(browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: NSError) {
        listening = false
        print("didNotStartingBrowsingForPeers \(error)")
    }
}
