//
//  Thali CordovaPlugin
//  AdvertiserManager.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license
//  information.
//

import Foundation

// Class for managing Thali advertiser's logic
@objc public final class AdvertiserManager: NSObject {
    private let disposeAdvertiserTimeout: Double
    private let serviceType: String
    internal private(set) var advertisers: Atomic<[Advertiser]> = Atomic([])
    internal private(set) var currentAdvertiser: Advertiser? = nil

    let socketRelay: SocketRelay<AdvertiserVirtualSocketBuilder>
    internal var didRemoveAdvertiserWithIdentifierHandler: ((PeerIdentifier) -> Void)?

    public var advertising: Bool {
        return currentAdvertiser?.advertising ?? false
    }

    /**

     - parameter serviceType:               The type of service to advertise
     - parameter disposeAdvertiserTimeout:  Time in seconds after old version of advertiser will be
     disposed
     - parameter inputStreamReceiveTimeout: Timeout in seconds for receiving input stream

     */
    public init(serviceType: String, disposeAdvertiserTimeout: Double,
                inputStreamReceiveTimeout: Double) {
        self.disposeAdvertiserTimeout = disposeAdvertiserTimeout
        self.serviceType = serviceType
        socketRelay = SocketRelay<AdvertiserVirtualSocketBuilder>(createSocketTimeout: inputStreamReceiveTimeout)
    }

    private func handle(session: Session, withPort port: UInt16) {
        socketRelay.createSocket(with: session, onPort: port) { port, error in
        }
    }

    //dispose advertiser after timeout to ensure that it has no pending invitations
    private func addAdvertiserToDisposeQueue(advertiser: Advertiser) {
        let delayTime = dispatch_time(DISPATCH_TIME_NOW,
                                      Int64(self.disposeAdvertiserTimeout * Double(NSEC_PER_SEC)))
        dispatch_after(delayTime, dispatch_get_main_queue()) {
            advertiser.stopAdvertising()

            self.advertisers.modify {
                if let index = $0.indexOf(advertiser) {
                    $0.removeAtIndex(index)
                }
            }

            self.didRemoveAdvertiserWithIdentifierHandler?(advertiser.peerIdentifier)
        }
    }

    private func startAdvertiser(with identifier: PeerIdentifier, port: UInt16,
                                 errorHandler: ErrorType -> Void) -> Advertiser {
        let advertiser = Advertiser(peerIdentifier: identifier, serviceType: serviceType,
                                    receivedInvitationHandler: { [weak self] session in
                                        self?.handle(session, withPort: port)
            }, disconnectHandler: {
                //todo disconnect notification
        })
        advertiser.startAdvertising(errorHandler)
        advertisers.modify {
            $0.append(advertiser)
        }
        return advertiser
    }

    public func stopAdvertising() {
        advertisers.withValue {
            $0.forEach {
                $0.stopAdvertising()
            }
        }
        advertisers.modify {
            $0.removeAll()
        }
        currentAdvertiser = nil
    }

    public func startUpdateAdvertisingAndListening(withPort port: UInt16, errorHandler: ErrorType -> Void) {
        if let currentAdvertiser = currentAdvertiser {
            let peerIdentifier = currentAdvertiser.peerIdentifier.nextGenerationPeer()
            addAdvertiserToDisposeQueue(currentAdvertiser)
            self.currentAdvertiser = startAdvertiser(with: peerIdentifier, port: port, errorHandler: errorHandler)
        } else {
            self.currentAdvertiser = startAdvertiser(with: PeerIdentifier(), port: port, errorHandler: errorHandler)
        }

        assert(self.currentAdvertiser != nil,
                "we should have initialized advertiser after calling this function")
    }
}
