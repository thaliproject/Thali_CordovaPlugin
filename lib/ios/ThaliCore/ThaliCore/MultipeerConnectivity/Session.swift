//
//  Thali CordovaPlugin
//  SessionManager.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation
import MultipeerConnectivity

/// Class for managing session between peers
class Session: NSObject {
    private enum SessionState {
        case Initial
        case Connecting
        case Connected
        case NotConnected
        
        init(sessionState: MCSessionState) {
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
    private let identifier: String
    private var sessionState: SessionState = .Initial {
        didSet {
            stateChangesHandler?(sessionState)
        }
    }
    private var stateChangesHandler: ((SessionState) -> Void)? = nil

    init(session: MCSession, identifier: String) {
        self.session = session
        self.identifier = identifier
        super.init()
        self.session.delegate = self
    }

    func disconnect() {
        session.disconnect()
    }

    func startListening(onPort port: UInt16, connectionCallback: ((ErrorType?) -> Void)){
        stateChangesHandler = { state in
            switch state {
            case .NotConnected:
                connectionCallback(NSError(domain: "asd", code: 0, userInfo: nil))
            case .Connected:
                connectionCallback(nil)
            default:
                break
            }
        }
        //sync issue
        if sessionState != .Initial {
            stateChangesHandler?(sessionState)
        }
    }
}

extension Session: MCSessionDelegate {
    func session(session: MCSession, peer peerID: MCPeerID, didChangeState state: MCSessionState) {
        //in current version we can have only one peer to communicate
        guard identifier == peerID.displayName else {
            return
        }
        self.sessionState = SessionState(sessionState: state)
    }

    func session(session: MCSession, didReceiveStream stream: NSInputStream,
                 withName streamName: String, fromPeer peerID: MCPeerID) {
    }

    func session(session: MCSession, didReceiveData data: NSData, fromPeer peerID: MCPeerID) {}
    func session(session: MCSession, didStartReceivingResourceWithName resourceName: String,
                 fromPeer peerID: MCPeerID, withProgress progress: NSProgress) {}
    func session(session: MCSession, didFinishReceivingResourceWithName resourceName: String,
                 fromPeer peerID: MCPeerID, atURL localURL: NSURL, withError error: NSError?) {}
}
