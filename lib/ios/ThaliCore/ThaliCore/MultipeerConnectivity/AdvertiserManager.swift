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
    let socketRelay = SocketRelay<AdvertiserVirtualSocketBuilder>()
    internal private(set) var advertisers: Atomic<[Advertiser]> = Atomic([])
    internal private(set) var currentAdvertiser: Advertiser? = nil
    private let serviceType: String
    internal var didRemoveAdvertiserWithIdentifierHandler: ((PeerIdentifier) -> Void)?

    public var advertising: Bool {
        return currentAdvertiser?.advertising ?? false
    }

    public init(serviceType: String) {
        self.serviceType = serviceType
    }

    private func handle(session: Session, withPort port: UInt16) {
        socketRelay.createSocket(with: session, onPort: port) { port, error in
        }
    }

    //dispose advertiser after 30 sec to ensure that it has no pending invitations
    func addAdvertiserToDisposeQueue(advertiser: Advertiser, withTimeout timeout: Double = 30) {
        let delayTime = dispatch_time(DISPATCH_TIME_NOW, Int64(timeout * Double(NSEC_PER_SEC)))
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
        let advertiser = Advertiser(peerIdentifier: identifier, serviceType: serviceType) { [weak self] session in
            self?.handle(session, withPort: port)
        }
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
