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
    private let disposeAdvertiserTimeout: Double
    private let serviceType: String
    internal private(set) var advertisers: Atomic<[Advertiser]> = Atomic([])
    internal private(set) var currentAdvertiser: Advertiser? = nil

    let socketRelay = SocketRelay<AdvertiserVirtualSocketBuilder>(createSocketTimeout: 5)
    internal var didRemoveAdvertiserWithIdentifierHandler: ((PeerIdentifier) -> Void)?

    public var advertising: Bool {
        return currentAdvertiser?.advertising ?? false
    }

    public init(serviceType: String, disposeAdvertiserTimeout: Double) {
        self.disposeAdvertiserTimeout = disposeAdvertiserTimeout
        self.serviceType = serviceType
    }

    private func handle(session: Session, withPort port: UInt16) {
        socketRelay.createSocket(with: session, onPort: port) { port, error in
        }
    }

    //dispose advertiser after timeout to ensure that it has no pending invitations
    func addAdvertiserToDisposeQueue(advertiser: Advertiser) {
        let delayTime = dispatch_time(DISPATCH_TIME_NOW, Int64(self.disposeAdvertiserTimeout * Double(NSEC_PER_SEC)))
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

    private func startAdvertiser(with identifier: PeerIdentifier, port: UInt16) -> Advertiser {
        let advertiser = Advertiser(peerIdentifier: identifier, serviceType: serviceType,
                                    receivedInvitationHandler: { [weak self] session in
                                        self?.handle(session, withPort: port)
            }, disconnectHandler: {
                //todo disconnect notification
        })
        advertiser.startAdvertising()
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

    public func startUpdateAdvertisingAndListening(port: UInt16) {
        if let currentAdvertiser = currentAdvertiser {
            let peerIdentifier = currentAdvertiser.peerIdentifier.nextGenerationPeer()
            addAdvertiserToDisposeQueue(currentAdvertiser)
            self.currentAdvertiser = startAdvertiser(with: peerIdentifier, port: port)
        } else {
            self.currentAdvertiser = startAdvertiser(with: PeerIdentifier(), port: port)
        }

        assert(self.currentAdvertiser != nil, "we should have initialized advertiser after calling this function")
    }
}
