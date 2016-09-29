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
    private let inputStreamReceiveTimeout: NSTimeInterval
    private let disposeAdvertiserTimeout: NSTimeInterval


    // MARK: - Public state
    /**

     - parameter serviceType:               The type of service to advertise
     - parameter disposeAdvertiserTimeout:  Time in seconds after old version of advertiser will be
     disposed
     - parameter inputStreamReceiveTimeout: Timeout in seconds for receiving input stream

     */
    public init(serviceType: String,
                disposeAdvertiserTimeout: NSTimeInterval,
                inputStreamReceiveTimeout: NSTimeInterval) {
        self.serviceType = serviceType
        self.disposeAdvertiserTimeout = disposeAdvertiserTimeout
        self.inputStreamReceiveTimeout = inputStreamReceiveTimeout
}


    public func startUpdateAdvertisingAndListening(onPort port: UInt16,
                                                    errorHandler: ErrorType -> Void) {

        let advertiser: Advertiser?
        var newPeerIdentifier = PeerIdentifier()

        if let currentAdvertiser = currentAdvertiser {
            disposeAdvertiserAfterTimeout(currentAdvertiser)
            newPeerIdentifier = currentAdvertiser.peerIdentifier.nextGenerationPeer()
        }

        advertiser = Advertiser(peerIdentifier: newPeerIdentifier,
                                serviceType: serviceType,
                                receivedInvitationHandler: {
                                    [weak self] session in

                                    guard let strongSelf = self else {
                                        return
                                    }

                                    strongSelf.relay = Relay(
                                        with: session,
                                        createSocketTimeout: strongSelf.inputStreamReceiveTimeout
                                    )
                                    strongSelf.relay?.createVirtualSocket()
                                    strongSelf.relay?.createTCPListenerAndConnect(to: 34000) {
                                        port, error in
                                    }
                                },
                                disconnectHandler: {
                                    // TODO: fix with #1040
                                })

        if let advertiser = advertiser {
            advertiser.startAdvertising(errorHandler)
            advertisers.modify({ $0.append(advertiser) })
        }

        self.currentAdvertiser = advertiser

        assert(
            self.currentAdvertiser != nil,
            "We should have initialized advertiser after calling this function"
        )
    }

    public func stopAdvertising() {
        advertisers.withValue {
            $0.forEach { $0.stopAdvertising() }
        }
        advertisers.modify { $0.removeAll() }
        currentAdvertiser = nil
    }

    // MARK: - Private methods

    // In any case when a peer starts a new MCNearbyServiceAdvertiser object
    // it MUST keep the old object around for at least 30 seconds.
    // This is to allow any in progress invites to finish.
    private func disposeAdvertiserAfterTimeout(advertiserToDispose: Advertiser) {
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
