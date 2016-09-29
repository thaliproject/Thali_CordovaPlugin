//
//  Thali CordovaPlugin
//  BrowserManager.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import Foundation

// Class for managing Thali browser's logic
public final class BrowserManager: NSObject {

    // MARK: - Public state
    public var listening: Bool {
        return currentBrowser?.listening ?? false
    }

    // MARK: - Internal state
    internal private(set) var availablePeers: Atomic<[PeerIdentifier]> = Atomic([])
    internal private(set) var activeRelays: Atomic<[String : Relay<BrowserVirtualSocketBuilder>]> =
        Atomic([:])

    // MARK: - Private state
    private var currentBrowser: Browser?
    private let serviceType: String
    private let inputStreamReceiveTimeout: NSTimeInterval
    private let peersAvailabilityChangedHandler: ([PeerAvailability]) -> Void

    // MARK: - Public state
    public init(serviceType: String,
                inputStreamReceiveTimeout: NSTimeInterval,
                peersAvailabilityChangedHandler: ([PeerAvailability]) -> Void) {
        self.serviceType = serviceType
        self.peersAvailabilityChangedHandler = peersAvailabilityChangedHandler
        self.inputStreamReceiveTimeout = inputStreamReceiveTimeout
    }

    public func startListeningForAdvertisements(errorHandler: ErrorType -> Void) {
        if currentBrowser != nil {
            return
        }
        let browser = Browser(serviceType: serviceType,
                              foundPeer: handleFoundPeer,
                              lostPeer: handleLostPeer)
        browser.startListening(errorHandler)
        self.currentBrowser = browser
    }

    public func stopListeningForAdvertisements() {
        currentBrowser?.stopListening()
        self.currentBrowser = nil
    }

    public func connectToPeer(identifier: PeerIdentifier,
                              syncValue: String,
                              completion: MultiConnectResolvedCallback) {

        guard let currentBrowser = self.currentBrowser else {
            completion(syncValue: syncValue,
                       error: ThaliCoreError.StartListeningNotActive,
                       port: nil)
            return
        }

        let activeSessionExists = (nil != activeRelays.value[identifier.uuid])

        if activeSessionExists {
            let port: UInt16? = activeRelays.value[identifier.uuid]?.listenerPort
            completion(syncValue: syncValue,
                       error: nil,
                       port: port)
        }

        guard
            let lastGenerationIdentifier = self.lastGenerationPeerIdentifier(for: identifier) else {
                completion(syncValue: syncValue,
                           error: ThaliCoreError.IllegalPeerID,
                           port: nil)
                return
        }

        do {
            let session = try currentBrowser.inviteToConnectPeer(
                with: lastGenerationIdentifier,
                sessionConnectHandler: {
                    [weak self] in

                    guard let strongSelf = self else {
                        return
                    }

                    let relay = strongSelf.activeRelays.withValue { $0[identifier.uuid] }
                    relay?.createTCPListenerWithCompletionHandler {
                        port, error in
                        completion(syncValue: syncValue, error: error, port: port)
                    }
                    relay?.createVirtualSocket()
                },
                sessionDisconnectHandler: {
                    [weak self] in

                    guard let strongSelf = self else {
                        return
                    }

                    strongSelf.activeRelays.modify {
                        if let relay = $0[identifier.uuid] {
                            relay.closeVirtualSocket()
                            relay.closeTCPListener()
                        }
                        $0[identifier.uuid] = nil
                    }

                    completion(syncValue: syncValue,
                               error: ThaliCoreError.ConnectionFailed,
                               port: nil)
                }
            )

            let relay: Relay<BrowserVirtualSocketBuilder> =
                Relay(with: session,
                      createSocketTimeout: self.inputStreamReceiveTimeout)

            activeRelays.modify { $0[identifier.uuid] = relay }
        } catch let error {
            completion(syncValue: syncValue,
                       error: error,
                       port: nil)
        }
    }

    public func disconnect(peerIdentifier: PeerIdentifier) {
        guard let relay = activeRelays.value[peerIdentifier.uuid] else {
            return
        }

        relay.session.disconnect()
    }

    func lastGenerationPeerIdentifier(for identifier: PeerIdentifier) -> PeerIdentifier? {
        return availablePeers.withValue {
            $0
            .filter { $0.uuid == identifier.uuid }
            .maxElement { $0.0.generation < $0.1.generation }
        }
    }

    // MARK: - Private methods
    private func handleFoundPeer(with identifier: PeerIdentifier) {
        let peerAvailability = PeerAvailability(peerIdentifier: identifier,
                                                available: true)

        availablePeers.modify { $0.append(identifier) }
        peersAvailabilityChangedHandler([peerAvailability])
    }

    private func handleLostPeer(with identifier: PeerIdentifier) {
        let peerAvailability = PeerAvailability(peerIdentifier: identifier,
                                                available: false)

        availablePeers.modify {
            if let indexOfLostPeer = $0.indexOf(identifier) {
                $0.removeAtIndex(indexOfLostPeer)
            }
        }
        peersAvailabilityChangedHandler([peerAvailability])
    }
}
