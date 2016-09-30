//
//  Thali CordovaPlugin
//  AdvertiserManager.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import Foundation

// Class for managing Thali advertiser's logic
public final class AdvertiserManager: NSObject {

    // MARK: - Public state
    public var advertising: Bool {
        return currentAdvertiser?.advertising ?? false
    }

    // MARK: - Internal state
    internal private(set) var advertisers: Atomic<[Advertiser]> = Atomic([])
    internal var didRemoveAdvertiserWithIdentifierHandler: ((PeerIdentifier) -> Void)?

    // MARK: - Private state
    private var currentAdvertiser: Advertiser? = nil
    private let serviceType: String
    private var relay: Relay<AdvertiserVirtualSocketBuilder>? = nil
    private let disposeAdvertiserTimeout: NSTimeInterval

    // MARK: - Public state
    public init(serviceType: String, disposeAdvertiserTimeout: NSTimeInterval) {
        self.serviceType = serviceType
        self.disposeAdvertiserTimeout = disposeAdvertiserTimeout
        super.init()
    }

    public func startUpdateAdvertisingAndListening(onPort port: UInt16,
                                                          errorHandler: ErrorType -> Void) {

        let advertiser: Advertiser?
        var newPeerIdentifier = PeerIdentifier()

        if let currentAdvertiser = currentAdvertiser {
            disposeAdvertiserAfterTimeoutToFinishInvites(currentAdvertiser)
            newPeerIdentifier = currentAdvertiser.peerIdentifier.nextGenerationPeer()
        }

        advertiser = Advertiser(peerIdentifier: newPeerIdentifier,
                                serviceType: serviceType,
                                receivedInvitationHandler: {
                                    [weak self] session in

                                    guard let strongSelf = self else {
                                        return
                                    }

                                    strongSelf.relay = Relay(with: session, createSocketTimeout: 0)

                                    strongSelf.relay?.openRelay(on: port) {
                                        port, error in
                                    }
                                },
                                disconnectHandler: {
                                    [weak self] in

                                    guard let strongSelf = self else {
                                        return
                                    }

                                    strongSelf.relay?.closeRelay()
                                })

        if let advertiser = advertiser {
            advertiser.startAdvertising(errorHandler)
            advertisers.modify({ $0.append(advertiser) })
        }

        self.currentAdvertiser = advertiser

        defer {
            assert(self.currentAdvertiser != nil,
                   "We should have initialized advertiser after calling this function")
        }

        guard currentAdvertiser != nil else {
            return
        }
    }

    public func stopAdvertising() {
        advertisers.withValue {
            $0.forEach { $0.stopAdvertising() }
        }
        advertisers.modify { $0.removeAll() }
        currentAdvertiser = nil
    }

    // MARK: - Private methods
    private func disposeAdvertiserAfterTimeoutToFinishInvites(advertiserToDispose: Advertiser) {
        let disposeTimeout = dispatch_time(
            DISPATCH_TIME_NOW,
            Int64(self.disposeAdvertiserTimeout * Double(NSEC_PER_SEC))
        )

        dispatch_after(disposeTimeout, dispatch_get_main_queue()) {
            advertiserToDispose.stopAdvertising()

            self.advertisers.modify {
                if let indexOfDisposingAdvertiser = $0.indexOf(advertiserToDispose) {
                    $0.removeAtIndex(indexOfDisposingAdvertiser)
                }
            }

            self.didRemoveAdvertiserWithIdentifierHandler?(advertiserToDispose.peerIdentifier)
        }
    }
}
