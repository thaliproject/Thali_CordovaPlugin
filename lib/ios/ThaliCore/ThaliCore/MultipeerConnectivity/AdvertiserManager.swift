//
//  Thali CordovaPlugin
//  AdvertiserManager.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation

//class for managing Thali advertiser's logic
@objc public final class AdvertiserManager: NSObject {
    private var advertisers: [Advertiser] = []
    private var currentAdvertiser: Advertiser? = nil
    private let serviceType: String
    private let disposeQueue = NSOperationQueue()

    public init(serviceType: String) {
        self.serviceType = serviceType
    }

    func addAdvertiserToDisposeQueue(advertiser: Advertiser) {
        let disposeOperation = NSBlockOperation() {
            advertiser.stopAdvertising()
        }

        let delayTime = dispatch_time(DISPATCH_TIME_NOW, Int64(30 * Double(NSEC_PER_SEC)))
        dispatch_after(delayTime, dispatch_get_main_queue()) {
            self.disposeQueue.addOperation(disposeOperation)
        }
    }

    private func createAndRunAdvertiserWith(identifier: PeerIdentifier, port: UInt16) -> Advertiser {
        let advertiser = Advertiser(peerIdentifier: identifier, serviceType: serviceType, port: port)
        advertiser.startAdvertising()
        return advertiser
    }

    public func startAdvertisingAndListening(port: UInt16) {

        if let currentAdvertiser = currentAdvertiser {
            let peerIdentifier = currentAdvertiser.peerIdentifier.nextGenerationPeer()
            addAdvertiserToDisposeQueue(currentAdvertiser)
            self.currentAdvertiser = createAndRunAdvertiserWith(peerIdentifier, port: port)
        } else {
            self.currentAdvertiser = createAndRunAdvertiserWith(PeerIdentifier(), port: port)
        }

        assert(self.currentAdvertiser != nil, "we should have initialized advertiser after calling this function")
    }

    public func stopAdvertisingAndListening() {
        guard let currentAdvertiser = self.currentAdvertiser where currentAdvertiser.isAdvertising else {
            assert(false, "there is no active listener")
            return
        }
        currentAdvertiser.stopAdvertising()
    }
    
    public func startUpdateAdvertisingAndListening(port: UInt16) {
        
    }
}
