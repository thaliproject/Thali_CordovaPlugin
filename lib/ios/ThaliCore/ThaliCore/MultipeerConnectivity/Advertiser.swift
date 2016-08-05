//
//  Thali CordovaPlugin
//  Advertiser.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation
import MultipeerConnectivity

public class Advertiser: NSObject, MultipeerServiceType {
    public let peerIdentifier: PeerIdentifier
    private let advertiser: MCNearbyServiceAdvertiser

    required public init(peerIdentifier: PeerIdentifier, serviceType: String) {
        //todo add discovery info parameter
        advertiser = MCNearbyServiceAdvertiser(peer: peerIdentifier.mcPeer,
                                               discoveryInfo:nil, serviceType: serviceType)
        self.peerIdentifier = peerIdentifier
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

extension Advertiser: MCNearbyServiceAdvertiserDelegate {

    public func advertiser(advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID,
                    withContext context: NSData?, invitationHandler: (Bool, MCSession) -> Void) {
        
        //todo call timer callback
        
        do {
            let _ = try MultipeerContext(data:context)
            
            //todo call update for peer
//            guard self.localPeerIdentifier == localPeerIdentifier else {
//                // Remote is trying to connect to a previous generation of us, reject
//                invitationHandler(false, sessionManager.session)
//                return
//            }
            //todo create tcp connection and accept MPC connection
        } catch let error {
            print(error)
        }
    }
    
    public func advertiser(advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: NSError) {
        print("WARNING: server didNotStartAdvertisingPeer")
    }
}
