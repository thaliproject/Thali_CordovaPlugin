//
//  Thali CordovaPlugin
//  AdvertiserManager.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

/**
 Manages Thali advertiser's logic
 */
public final class AdvertiserManager {

    // MARK: - Public state
    public var advertising: Bool {
        return currentAdvertiser?.advertising ?? false
    }

    // MARK: - Internal state
    internal fileprivate(set) var advertisers: Atomic<[Advertiser]> = Atomic([])
    internal fileprivate(set) var activeRelays: Atomic<[String: AdvertiserRelay]> = Atomic([:])
    internal var didDisposeAdvertiserForPeerHandler: ((Peer) -> Void)?

    // MARK: - Private state
    fileprivate var currentAdvertiser: Advertiser?
    fileprivate let serviceType: String
    fileprivate let disposeTimeout: TimeInterval

    // MARK: - Initialization
    public init(serviceType: String, disposeAdvertiserTimeout: TimeInterval) {
        self.serviceType = serviceType
        self.disposeTimeout = disposeAdvertiserTimeout
    }

    // MARK: - Public methods
    public func startUpdateAdvertisingAndListening(onPort port: UInt16,
                                                          errorHandler: @escaping (Error) -> Void) {
        if let currentAdvertiser = currentAdvertiser {
            disposeAdvertiserAfterTimeoutToFinishInvites(currentAdvertiser)
        }

        let newPeer = currentAdvertiser?.peer.nextGenerationPeer() ?? Peer()

        let advertiser = Advertiser(peer: newPeer,
                                    serviceType: serviceType,
                                    receivedInvitation: {
                                        [weak self] session in
                                        guard let strongSelf = self else { return }

                                        strongSelf.activeRelays.modify {
                                            let relay = AdvertiserRelay(with: session, on: port)
                                            $0[newPeer.uuid] = relay
                                        }
                                    },
                                    sessionNotConnected: {
                                        [weak self] in
                                        guard let strongSelf = self else { return }

                                        strongSelf.activeRelays.modify {
                                            if let relay = $0[newPeer.uuid] {
                                                relay.closeRelay()
                                            }
                                            $0.removeValue(forKey: newPeer.uuid)
                                        }
                                    })
        guard let newAdvertiser = advertiser else {
            errorHandler(ThaliCoreError.ConnectionFailed as Error)
            return
        }

        advertisers.modify {
            newAdvertiser.startAdvertising(errorHandler)
            $0.append(newAdvertiser)
        }

        self.currentAdvertiser = newAdvertiser
    }

    public func stopAdvertising() {
        advertisers.modify {
            $0.forEach { $0.stopAdvertising() }
            $0.removeAll()
        }
        currentAdvertiser = nil
    }

    public func hasAdvertiser(with identifier: String) -> Bool {
        return advertisers.value.filter { $0.peer.uuid == identifier }
                                .count > 0
    }

    // MARK: - Private methods
    fileprivate func disposeAdvertiserAfterTimeoutToFinishInvites(
        _ advertiserShouldBeDisposed: Advertiser) {

        let disposeTimeout = DispatchTime.now() +
            Double(Int64(self.disposeTimeout * Double(NSEC_PER_SEC))) / Double(NSEC_PER_SEC)

        DispatchQueue.main.asyncAfter(deadline: disposeTimeout) {
            [weak self,
             weak advertiserShouldBeDisposed] in
            guard let strongSelf = self else { return }
            guard let advertiserShouldBeDisposed = advertiserShouldBeDisposed else { return }

            strongSelf.advertisers.modify {
                advertiserShouldBeDisposed.stopAdvertising()
                if let indexOfDisposingAdvertiser = $0.index(of: advertiserShouldBeDisposed) {
                    $0.remove(at: indexOfDisposingAdvertiser)
                }
            }

            strongSelf.didDisposeAdvertiserForPeerHandler?(advertiserShouldBeDisposed.peer)
        }
    }
}
