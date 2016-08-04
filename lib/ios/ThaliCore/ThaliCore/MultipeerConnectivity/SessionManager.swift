//
//  Thali CordovaPlugin
//  SessionManager.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation
import MultipeerConnectivity

public class SessionManager: NSObject {
    let streamName: String
    let peerID: MCPeerID
    let session: MCSession
    
    var discoveryInfo: [String : String] {
        return ["PeerIdentifier" : peerID.displayName]
    }
    
    init(serviceName: String, peerName: String) {
        self.streamName = serviceName + "_stream"
        peerID = MCPeerID(displayName: peerName)
        session = MCSession(peer: peerID, securityIdentity: nil, encryptionPreference: .None)
        super.init()
    }
}

extension SessionManager: MCSessionDelegate {
    
    public func session(session: MCSession, peer peerID: MCPeerID, didChangeState state: MCSessionState) {
    }
    
    public func session(session: MCSession, didReceiveStream stream: NSInputStream, withName streamName: String,
                        fromPeer peerID: MCPeerID) {
        guard streamName == self.streamName else {
            assert(false, "Unexpected stream name")
            return
        }
        //todo [self setInputStream:inputStream];
    }
    
    
    public func session(session: MCSession, didReceiveData data: NSData, fromPeer peerID: MCPeerID) {}
    public func session(session: MCSession, didStartReceivingResourceWithName resourceName: String,
                        fromPeer peerID: MCPeerID, withProgress progress: NSProgress) {}
    
    public func session(session: MCSession, didFinishReceivingResourceWithName resourceName: String,
                        fromPeer peerID: MCPeerID, atURL localURL: NSURL, withError error: NSError?) {
    }
}
