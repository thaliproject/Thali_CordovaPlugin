//
//  Thali CordovaPlugin
//  Advertiser.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation
import MultipeerConnectivity

final class Advertiser: NSObject {
    private let advertiser: MCNearbyServiceAdvertiser

    let peerIdentifier: PeerIdentifier
    let serviceType: String
    let port: UInt16
    internal private(set) var isAdvertising: Bool = false

    required init(peerIdentifier: PeerIdentifier, serviceType: String, port: UInt16) {
        advertiser = MCNearbyServiceAdvertiser(peer: peerIdentifier.mcPeer,
                                               discoveryInfo:nil, serviceType: serviceType)
        self.peerIdentifier = peerIdentifier
        self.serviceType = serviceType
        self.port = port
        super.init()
        advertiser.delegate = self
    }
    
    func startAdvertising() {
        advertiser.startAdvertisingPeer()
        isAdvertising = true
    }
    
    func stopAdvertising() {
        advertiser.stopAdvertisingPeer()
        isAdvertising = false
    }
}

extension Advertiser: MCNearbyServiceAdvertiserDelegate {

    func advertiser(advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID,
                    withContext context: NSData?, invitationHandler: (Bool, MCSession) -> Void) {
        
    }
    
    func advertiser(advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: NSError) {
        isAdvertising = false
        print("WARNING: server didNotStartAdvertisingPeer")
    }
}
