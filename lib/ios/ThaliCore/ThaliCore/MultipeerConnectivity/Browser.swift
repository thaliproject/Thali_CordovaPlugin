//
//  Thali CordovaPlugin
//  Browser.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import Foundation
import MultipeerConnectivity

final class Browser: NSObject {

    // MARK: - Internal state
    internal private(set) var listening: Bool = false
    internal let invitePeerTimeout: NSTimeInterval = 30.0

    // MARK: - Private state
    private let browser: MCNearbyServiceBrowser
    private var availablePeers: Atomic<[PeerIdentifier: MCPeerID]> = Atomic([:])
    private let didFindPeerHandler: (PeerIdentifier) -> Void
    private let didLosePeerHandler: (PeerIdentifier) -> Void
    private var startBrowsingErrorHandler: (ErrorType -> Void)? = nil

    // MARK: - Public methods
    required init(serviceType: String,
                  foundPeer: (PeerIdentifier) -> Void,
                  lostPeer: (PeerIdentifier) -> Void) {
        let peerId = MCPeerID(displayName: NSUUID().UUIDString)
        browser = MCNearbyServiceBrowser(peer: peerId, serviceType: serviceType)
        didFindPeerHandler = foundPeer
        didLosePeerHandler = lostPeer
        super.init()
    }

    func startListening(startListeningErrorHandler: ErrorType -> Void) {
        startBrowsingErrorHandler = startListeningErrorHandler
        browser.delegate = self
        browser.startBrowsingForPeers()
        listening = true
    }

    func stopListening() {
        browser.delegate = nil
        browser.stopBrowsingForPeers()
        listening = false
    }

    /*!
     invites PeerIdentifier to session

     - parameter peerIdentifier: peer identifier to invite
     - parameter disconnectHandler: notifies about session not connected state

     - throws: IllegalPeerID

     - returns: Session object for managing multipeer session between devices
     */
    func inviteToConnectPeer(with peerIdentifier: PeerIdentifier,
                                  sessionConnectHandler: () -> Void,
                                  sessionDisconnectHandler: () -> Void) throws -> Session {

        let mcSession = MCSession(peer: browser.myPeerID,
                                  securityIdentity: nil,
                                  encryptionPreference: .None)

        guard let mcPeer = availablePeers.value[peerIdentifier] else {
            throw ThaliCoreError.IllegalPeerID
        }

        let session = Session(session: mcSession,
                              identifier: mcPeer,
                              connectHandler: sessionConnectHandler,
                              disconnectHandler: sessionDisconnectHandler)

        browser.invitePeer(mcPeer,
                           toSession: mcSession,
                           withContext: nil,
                           timeout: invitePeerTimeout)
        return session
    }
}

// MARK: - MCNearbyServiceBrowserDelegate
extension Browser: MCNearbyServiceBrowserDelegate {

    func browser(browser: MCNearbyServiceBrowser,
                 foundPeer peerID: MCPeerID,
                 withDiscoveryInfo info: [String : String]?) {
        do {
            let peerIdentifier = try PeerIdentifier(peerID: peerID)
            availablePeers.modify { $0[peerIdentifier] = peerID }
            didFindPeerHandler(peerIdentifier)
        } catch let error {
            print("cannot parse identifier \"\(peerID.displayName)\" because of error: \(error)")
        }
    }

    func browser(browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        do {
            let peerIdentifier = try PeerIdentifier(peerID: peerID)
            availablePeers.modify { $0.removeValueForKey(peerIdentifier) }
            didLosePeerHandler(peerIdentifier)
        } catch let error {
            print("cannot parse identifier \"\(peerID.displayName)\" because of error: \(error)")
        }
    }

    func browser(browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: NSError) {
        stopListening()
        startBrowsingErrorHandler?(error)
    }
}
