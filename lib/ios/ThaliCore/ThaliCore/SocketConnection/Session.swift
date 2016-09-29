//
//  Thali CordovaPlugin
//  Session.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import Foundation
import MultipeerConnectivity

/// Class for managing MCSession: subscribing for incoming streams and creating output streams
class Session: NSObject {

    // MARK: - Internal state
    internal private(set) var sessionState: Atomic<MCSessionState> = Atomic(.NotConnected)
    internal var sessionStateChangesHandler: ((MCSessionState) -> Void)?
    internal var didReceiveInputStreamHandler: ((NSInputStream, String) -> Void)?

    // MARK: - Private state
    private let session: MCSession
    private let identifier: MCPeerID
    private let connectHandler: () -> Void
    private let disconnectHandler: () -> Void

    // MARK: - Public methods
    init(session: MCSession,
         identifier: MCPeerID,
         connectHandler: () -> Void,
         disconnectHandler: () -> Void) {

        self.session = session
        self.identifier = identifier
        self.connectHandler = connectHandler
        self.disconnectHandler = disconnectHandler
        super.init()
        self.session.delegate = self
    }

    func createOutputStream(with name: String) throws -> NSOutputStream {
        return try session.startStreamWithName(name, toPeer: identifier)
    }

    func disconnect() {
        session.disconnect()
    }
}

// MARK: - Handling events for MCSession
extension Session: MCSessionDelegate {

    func session(session: MCSession, peer peerID: MCPeerID, didChangeState state: MCSessionState) {
        assert(identifier.displayName == peerID.displayName)

        sessionState.modify { $0 = state }
        sessionStateChangesHandler?(state)

        switch state {
        case .NotConnected:
            disconnectHandler()
        case .Connected:
            connectHandler()
        case .Connecting:
            break
        }
    }

    func session(session: MCSession,
                 didReceiveCertificate certificate: [AnyObject]?,
                 fromPeer peerID: MCPeerID,
                 certificateHandler: (Bool) -> Void) {
        // FIXME: in the future we should accept only trusted certificate
        certificateHandler(true)
    }


    func session(session: MCSession, didReceiveStream stream: NSInputStream,
                 withName streamName: String, fromPeer peerID: MCPeerID) {
        assert(identifier.displayName == peerID.displayName)
        didReceiveInputStreamHandler?(stream, streamName)
    }

    func session(session: MCSession, didReceiveData data: NSData, fromPeer peerID: MCPeerID) {}
    func session(session: MCSession, didStartReceivingResourceWithName resourceName: String,
                 fromPeer peerID: MCPeerID, withProgress progress: NSProgress) {}
    func session(session: MCSession, didFinishReceivingResourceWithName resourceName: String,
                 fromPeer peerID: MCPeerID, atURL localURL: NSURL, withError error: NSError?) {}
}
