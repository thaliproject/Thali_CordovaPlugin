//
//  Thali CordovaPlugin
//  Session.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation
import MultipeerConnectivity

/// Class for managing MCSession: subscribing for incoming streams and creating output streams
class Session: NSObject {
    enum SessionState {
        case Connecting
        case Connected
        case NotConnected

        private init(sessionState: MCSessionState) {
            switch sessionState {
            case .Connected:
                self = .Connected
            case .Connecting:
                self = .Connecting
            case .NotConnected:
                self = .NotConnected
            }
        }
    }

    private let session: MCSession
    private let identifier: MCPeerID
    var sessionStateDidChangeHandler: ((SessionState) -> Void)?
    var didReceiveInputStream: ((NSInputStream, String) -> Void)?
    internal private(set) var inputStreams: [NSInputStream] = []
    internal private(set) var outputStreams: [NSOutputStream] = []
    internal private(set) var sessionState: SessionState = .NotConnected

    func createOutputStream(withName name: String) throws -> NSOutputStream {
        let stream = try session.startStreamWithName(name, toPeer: identifier)
        outputStreams.append(stream)
        return stream
    }

    init(session: MCSession, identifier: MCPeerID) {
        self.session = session
        self.identifier = identifier
        super.init()
        self.session.delegate = self
    }
}

extension Session: MCSessionDelegate {
    func session(session: MCSession, peer peerID: MCPeerID, didChangeState state: MCSessionState) {
        guard identifier.displayName == peerID.displayName else {
            print("ignoring peer state changes \(peerID.displayName)")
            return
        }
        self.sessionState = SessionState(sessionState: state)
        sessionStateDidChangeHandler?(sessionState)
    }

    func session(session: MCSession, didReceiveStream stream: NSInputStream,
                 withName streamName: String, fromPeer peerID: MCPeerID) {
        guard identifier.displayName == peerID.displayName else {
            print("ignoring stream from peer \(peerID.displayName)")
            return
        }
        didReceiveInputStream?(stream, streamName)
    }

    func session(session: MCSession, didReceiveData data: NSData, fromPeer peerID: MCPeerID) {}
    func session(session: MCSession, didStartReceivingResourceWithName resourceName: String,
                 fromPeer peerID: MCPeerID, withProgress progress: NSProgress) {}
    func session(session: MCSession, didFinishReceivingResourceWithName resourceName: String,
                 fromPeer peerID: MCPeerID, atURL localURL: NSURL, withError error: NSError?) {}
}
