//
//  Thali CordovaPlugin
//  Advertiser.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation
import MultipeerConnectivity

class Advertiser: NSObject, MultipeerService {
    let peerIdentifier: PeerIdentifier
    private let advertiser: MCNearbyServiceAdvertiser

    required init(peerIdentifier: PeerIdentifier, serviceType: String) {
        advertiser = MCNearbyServiceAdvertiser(peer: peerIdentifier.mcPeer,
                                               discoveryInfo:nil, serviceType: serviceType)
        self.peerIdentifier = peerIdentifier
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

extension Advertiser: MCNearbyServiceAdvertiserDelegate {

    func advertiser(advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID,
                    withContext context: NSData?, invitationHandler: (Bool, MCSession) -> Void) {
    }
    
    func advertiser(advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: NSError) {
        print("WARNING: server didNotStartAdvertisingPeer")
    }
}
