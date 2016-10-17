//
//  Thali CordovaPlugin
//  BrowserManager.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

/**
 Manages Thali browser's logic
 */
public final class BrowserManager {

    // MARK: - Public state
    public var listening: Bool {
        return currentBrowser?.listening ?? false
    }

    // MARK: - Internal state
    internal private(set) var availablePeers: Atomic<[Peer]> = Atomic([])
    internal private(set) var activeRelays: Atomic<[String: BrowserRelay]> = Atomic([:])

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

    // MARK: - Public methods
    public func startListeningForAdvertisements(errorHandler: ErrorType -> Void) {
        if currentBrowser != nil { return }

        let browser = Browser(serviceType: serviceType,
                              foundPeer: handleFound,
                              lostPeer: handleLost)

        guard let newBrowser = browser else {
            errorHandler(ThaliCoreError.ConnectionFailed)
            return
        }

        newBrowser.startListening(errorHandler)
        currentBrowser = newBrowser
    }

    public func stopListeningForAdvertisements() {
        currentBrowser?.stopListening()
        currentBrowser = nil
    }

    public func connectToPeer(peerIdentifier: String,
                              syncValue: String,
                              completion: (syncValue: String,
                                           error: ErrorType?,
                                           port: UInt16?) -> Void) {

        guard let currentBrowser = self.currentBrowser else {
            completion(syncValue: syncValue,
                       error: ThaliCoreError.StartListeningNotActive,
                       port: nil)
            return
        }

        if let activeRelay = activeRelays.value[peerIdentifier] {
            completion(syncValue: syncValue,
                       error: nil,
                       port: activeRelay.listenerPort)
            return
        }

        guard let lastGenerationPeer = self.lastGenerationPeer(for: peerIdentifier) else {
                completion(syncValue: syncValue,
                           error: ThaliCoreError.ConnectionFailed,
                           port: nil)
                return
        }

        do {
            let nonTCPsession = try currentBrowser.inviteToConnect(
                                        lastGenerationPeer,
                                        sessionConnected: {
                                            [weak self] in
                                            guard let strongSelf = self else { return }

                                            let relay =
                                                strongSelf.activeRelays.value[peerIdentifier]

                                            relay?.openRelay {
                                                port, error in
                                                completion(syncValue: syncValue,
                                                           error: error,
                                                           port: port)
                                            }
                                        },
                                        sessionNotConnected: {
                                            [weak self] in
                                            guard let strongSelf = self else { return }

                                            strongSelf.activeRelays.modify {
                                                if let relay = $0[peerIdentifier] {
                                                    relay.closeRelay()
                                                }
                                                $0.removeValueForKey(peerIdentifier)
                                            }
                                        })

            activeRelays.modify {
                let relay = BrowserRelay(with: nonTCPsession,
                                         createVirtualSocketTimeout: self.inputStreamReceiveTimeout)
                $0[peerIdentifier] = relay
            }
        } catch let error {
            completion(syncValue: syncValue,
                       error: error,
                       port: nil)
        }
    }

    public func disconnect(peerIdentifer: String) {
        guard let relay = activeRelays.value[peerIdentifer] else {
            return
        }

        relay.disconnectNonTCPSession()
    }

    // MARK: - Internal methods
    func lastGenerationPeer(for peerIdentifier: String) -> Peer? {
        return availablePeers.withValue {
            $0
            .filter { $0.uuid == peerIdentifier }
            .maxElement { $0.0.generation < $0.1.generation }
        }
    }

    // MARK: - Private handlers
    private func handleFound(peer: Peer) {
        availablePeers.modify { $0.append(peer) }

        let updatedPeerAvailability = PeerAvailability(peer: peer, available: true)
        peersAvailabilityChangedHandler([updatedPeerAvailability])
    }

    private func handleLost(peer: Peer) {
        availablePeers.modify {
            if let indexOfLostPeer = $0.indexOf(peer) {
                $0.removeAtIndex(indexOfLostPeer)
            }
        }

        let updatedPeerAvailability = PeerAvailability(peer: peer, available: false)
        peersAvailabilityChangedHandler([updatedPeerAvailability])
    }
}
