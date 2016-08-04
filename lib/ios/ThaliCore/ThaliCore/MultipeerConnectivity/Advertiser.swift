//
//  Thali CordovaPlugin
//  Advertiser.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation
import MultipeerConnectivity

public class Advertiser: NSObject, StreamService {
    let localPeerIdentifier: String = ""
    private let advertiser: MCNearbyServiceAdvertiser
    private let sessionManager: SessionManager
    
    required public init(serviceName: String, sessionManager: SessionManager) {
        self.sessionManager = sessionManager
        advertiser = MCNearbyServiceAdvertiser(peer: sessionManager.peerID,
                                               discoveryInfo:sessionManager.discoveryInfo, serviceType: serviceName)
        super.init()
        advertiser.delegate = self
    }
    
    public func start() {
        advertiser.startAdvertisingPeer()
    }
    
    public func stop() {
        advertiser.stopAdvertisingPeer()
    }
}

private enum ContextError: String, ErrorType {
    case MalformedData
    case CannotParse
}

func peerUUIDFromPeerIdentifier(peerIdentifier: String) -> String {
    return peerIdentifier.characters.split {
        $0 == ":"
        }.map(String.init)[0]
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
        let partsArray = String(data: data, encoding: NSUTF8StringEncoding)?.characters.split {
            $0 == "+"
            }.map(String.init)
        guard let parts = partsArray where parts.count == 2 else {
            throw ContextError.CannotParse
        }
        return (remotePeer: parts[0], localPeer: parts[1])
    }
    
    public func advertiser(advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID,
                    withContext context: NSData?, invitationHandler: (Bool, MCSession) -> Void) {
        
        //todo call timer callback
        
        do {
            let context = try unwrapContext(context)
            let (remotePeerIdentifier, localPeerIdentifier) = try parseContext(context)
            let (_, _) = (peerUUIDFromPeerIdentifier(remotePeerIdentifier), peerUUIDFromPeerIdentifier(localPeerIdentifier))
            
            //todo call update for peer
            
            guard self.localPeerIdentifier == localPeerIdentifier else {
                // Remote is trying to connect to a previous generation of us, reject
                //            invitationHandler(false, [_serverSession session]);
                invitationHandler(false, sessionManager.session)
                return
            }
            
            
            //todo create tcp connection and accept connection
            
            
        } catch let error {
            print(error)
        }
    }
    
    public func advertiser(advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: NSError) {
        print("WARNING: server didNotStartAdvertisingPeer")
    }
}
