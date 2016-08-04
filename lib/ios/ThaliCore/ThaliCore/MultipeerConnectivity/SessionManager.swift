//
//  The MIT License (MIT)
//
//  Copyright (c) 2016 Microsoft
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//  THE SOFTWARE.
//
//  Thali CordovaPlugin
//  StreamService.swift
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
