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
    internal private(set) var advertising: Bool = false
    private let receivedInvitationHandler: (peer: PeerIdentifier) -> Void

    required init(peerIdentifier: PeerIdentifier, serviceType: String, port: UInt16,
                  receivedInvitationHandler: (peer: PeerIdentifier) -> Void) {
        advertiser = MCNearbyServiceAdvertiser(peer: peerIdentifier.mcPeer,
                                               discoveryInfo:nil, serviceType: serviceType)
        self.peerIdentifier = peerIdentifier
        self.serviceType = serviceType
        self.port = port
        self.receivedInvitationHandler = receivedInvitationHandler
        super.init()
        advertiser.delegate = self
    }

    func startAdvertising() {
        advertiser.startAdvertisingPeer()
        advertising = true
    }

    func stopAdvertising() {
        advertiser.stopAdvertisingPeer()
        advertising = false
    }
}

extension Advertiser: MCNearbyServiceAdvertiserDelegate {

    func advertiser(advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID,
                    withContext context: NSData?, invitationHandler: (Bool, MCSession) -> Void) {
        do {
            let peer = try PeerIdentifier(mcPeer: peerID)
            receivedInvitationHandler(peer: peer)
        } catch let error {
            print("\(error) wrong peer format")
        }
    }

    func advertiser(advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: NSError) {
        advertising = false
        print("WARNING: server didNotStartAdvertisingPeer")
    }
}
