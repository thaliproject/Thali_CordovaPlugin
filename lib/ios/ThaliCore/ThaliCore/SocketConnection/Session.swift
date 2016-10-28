//
//  Thali CordovaPlugin
//  Session.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import MultipeerConnectivity

/**
 Manages underlying `MCSession`, handles `MCSessionDelegate` events.
 */
class Session: NSObject {

    // MARK: - Internal state
    internal fileprivate(set) var sessionState: Atomic<MCSessionState> = Atomic(.notConnected)
    internal var didChangeStateHandler: ((MCSessionState) -> Void)?
    internal var didReceiveInputStreamHandler: ((InputStream, String) -> Void)?

    // MARK: - Private state
    fileprivate let session: MCSession
    fileprivate let identifier: MCPeerID
    fileprivate let didConnectHandler: () -> Void
    fileprivate let didNotConnectHandler: () -> Void

    // MARK: - Public methods
    init(session: MCSession,
         identifier: MCPeerID,
         connected: @escaping () -> Void,
         notConnected: @escaping () -> Void) {

        self.session = session
        self.identifier = identifier
        self.didConnectHandler = connected
        self.didNotConnectHandler = notConnected
        super.init()
        self.session.delegate = self
    }

    func startOutputStream(with name: String) throws -> OutputStream {
        do {
            return try session.startStream(withName: name, toPeer: identifier)
        } catch {
            throw ThaliCoreError.ConnectionFailed
        }
    }

    func disconnect() {
        session.disconnect()
    }
}

// MARK: - MCSessionDelegate - Handling events for MCSession
extension Session: MCSessionDelegate {

    func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        assert(identifier.displayName == peerID.displayName)

        sessionState.modify {
            $0 = state

            self.didChangeStateHandler?(state)

            switch state {
            case .notConnected:
                self.didNotConnectHandler()
            case .connected:
                self.didConnectHandler()
            case .connecting:
                break
            }
        }

    }

    func session(_ session: MCSession,
                 didReceive stream: InputStream,
                 withName streamName: String,
                 fromPeer peerID: MCPeerID) {
        assert(identifier.displayName == peerID.displayName)
        didReceiveInputStreamHandler?(stream, streamName)
    }

    func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        assert(identifier.displayName == peerID.displayName)
    }

    func session(_ session: MCSession,
                 didStartReceivingResourceWithName resourceName: String,
                 fromPeer peerID: MCPeerID,
                 with progress: Progress) {
        assert(identifier.displayName == peerID.displayName)
    }

    func session(_ session: MCSession,
                 didFinishReceivingResourceWithName resourceName: String,
                 fromPeer peerID: MCPeerID,
                 at localURL: URL,
                 withError error: Error?) {
        assert(identifier.displayName == peerID.displayName)
    }
}
