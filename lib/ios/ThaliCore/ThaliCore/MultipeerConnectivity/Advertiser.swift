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
//  Advertiser.swift
//

import Foundation
import MultipeerConnectivity

class Advertiser: NSObject, StreamService {
    let localPeerIdentifier: String = ""
    let session: MCSession! = nil
    //todo remove `!`
    private let advertiser: MCNearbyServiceAdvertiser!
    
    required init(service: SocketService) {
        advertiser = nil
        super.init()
        advertiser.delegate = self
    }
    
    func start() {
        advertiser.startAdvertisingPeer()
    }
    
    func stop() {
        advertiser.stopAdvertisingPeer()
    }
}

private enum ContextError: String, ErrorType {
    case MalformedData
    case CannotParse
}

func peerUUIDFromPeerIdentifier(peerIdentifier: String) -> String {
    return peerIdentifier.characters.split{ $0 == ":"}.map(String.init)[0]
}

extension Advertiser: MCNearbyServiceAdvertiserDelegate {
    
    // If context doesn't look right just ignore the invitation.. don't get
    // into an argument with a malfunctioning/hostile peer
    private func unwrapContext(context: NSData?) throws -> NSData {
        guard let context = context where context.length <= 115 else {
            throw ContextError.MalformedData
        }
        return context
    }
    
    private func parseContext(data: NSData) throws -> (remotePeer: String, localPeer: String) {
        guard let parts = (String(data: data, encoding: NSUTF8StringEncoding)?.characters.split{ $0 == "+"}.map(String.init)) where parts.count == 2 else {
            throw ContextError.CannotParse
        }
        return (remotePeer: parts[0], localPeer: parts[1])
    }
    
    func advertiser(advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: NSData?, invitationHandler: (Bool, MCSession) -> Void) {
        
        //todo call timer callback
        
        do {
            let context = try unwrapContext(context)
            let (remotePeerIdentifier, localPeerIdentifier) = try parseContext(context)
            let (_, _) = (peerUUIDFromPeerIdentifier(remotePeerIdentifier), peerUUIDFromPeerIdentifier(localPeerIdentifier))
            
            //todo call update for peer
            
            guard self.localPeerIdentifier == localPeerIdentifier else {
                // Remote is trying to connect to a previous generation of us, reject
                //            invitationHandler(false, [_serverSession session]);
                invitationHandler(false, session)
                return;
            }
            
            
            //todo create connection to port           
            
        } catch let error {
            print(error)
        }
    }
    
    func advertiser(advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: NSError) {
        print("WARNING: server didNotStartAdvertisingPeer");
    }
}