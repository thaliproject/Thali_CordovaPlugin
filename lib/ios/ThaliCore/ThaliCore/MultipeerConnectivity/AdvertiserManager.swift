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
    internal private (set) var advertisers: [Advertiser] = []
    internal private (set) var currentAdvertiser: Advertiser? = nil
    private let serviceType: String
    internal var didRemoveAdvertiserWithIdentifierHandler: ((PeerIdentifier) -> Void)?
    internal private(set) var activeSessions: [PeerIdentifier: Session] = [:]

    public var isAdvertising: Bool {
        return currentAdvertiser?.isAdvertising ?? false
    }

    public init(serviceType: String) {
        self.serviceType = serviceType
    }

    private func receivedInvitationHandler(peerIdentifier: PeerIdentifier, session: Session) {

    }

    //dispose advertiser after 30 sec to ensure that it has no pending invitations
    func addAdvertiserToDisposeQueue(advertiser: Advertiser) {
        let delayTime = dispatch_time(DISPATCH_TIME_NOW, Int64(30 * Double(NSEC_PER_SEC)))
        dispatch_after(delayTime, dispatch_get_main_queue()) {
            sync(self) {
                advertiser.stopAdvertising()
                if let index = self.advertisers.indexOf(advertiser) {
                    self.advertisers.removeAtIndex(index)
                }
                self.didRemoveAdvertiserWithIdentifierHandler?(advertiser.peerIdentifier)
            }
        }
    }

    private func createAndRunAdvertiserWith(identifier: PeerIdentifier, port: UInt16) -> Advertiser {
        let advertiser = Advertiser(peerIdentifier: identifier, serviceType: serviceType,
                                    port: port, receivedInvitationHandler: { [weak self] session in
                                        guard let strongSelf = self else {
                                            return
                                        }
                                        sync(strongSelf) {
                                            session.startListening(onPort: port)
                                            strongSelf.activeSessions[identifier] = session
                                        }
        })
        advertiser.startAdvertising()
        self.advertisers.append(advertiser)
        return advertiser
    }

    public func stopAdvertisingAndListening() {
        advertisers.forEach {
            $0.stopAdvertising()
        }
        advertisers.removeAll()
        currentAdvertiser = nil
    }

    public func startUpdateAdvertisingAndListening(port: UInt16) {
        if let currentAdvertiser = currentAdvertiser {
            let peerIdentifier = currentAdvertiser.peerIdentifier.nextGenerationPeer()
            addAdvertiserToDisposeQueue(currentAdvertiser)
            self.currentAdvertiser = createAndRunAdvertiserWith(peerIdentifier, port: port)
        } else {
            self.currentAdvertiser = createAndRunAdvertiserWith(PeerIdentifier(), port: port)
        }

        assert(self.currentAdvertiser != nil, "we should have initialized advertiser after calling this function")
    }
}
