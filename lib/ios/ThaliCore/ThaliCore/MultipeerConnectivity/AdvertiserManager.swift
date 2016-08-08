//
//  Thali CordovaPlugin
//  AdvertiserManager.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation

//class for managing Thali advertiser's logic
@objc public class AdvertiserManager: NSObject {
    private var advertisers: [Advertiser] = []
    private var currentAdvertiser: Advertiser? = nil
    private let serviceType: String

    init(serviceType: String) {
        self.serviceType = serviceType
    }

    func addAdvertiserToDisposeQueue(advertiser: Advertiser) {
        //todo stop and dispose advertiser after 30 sec
    }

    private func createAndRunAdvertiserWith(identifier: PeerIdentifier) -> Advertiser {
        let advertiser = Advertiser(peerIdentifier: identifier, serviceType: serviceType)
        advertiser.start()
        return advertiser
    }

    public func startAdvertisingAndListeningToPort(port: UInt16) {

        if let currentAdvertiser = currentAdvertiser {
            let peerIdentifier = currentAdvertiser.peerIdentifier.nextGenerationPeer()
            addAdvertiserToDisposeQueue(currentAdvertiser)
            self.currentAdvertiser = createAndRunAdvertiserWith(peerIdentifier)
        } else {
            self.currentAdvertiser = Advertiser(peerIdentifier: PeerIdentifier(), serviceType: serviceType)
        }

        assert(self.currentAdvertiser != nil, "we should have initialized advertiser after calling this function")
    }

    public func stopAdvertisingAndListening() {

    }
}
