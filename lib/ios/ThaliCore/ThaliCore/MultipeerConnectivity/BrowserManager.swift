//
//  Thali CordovaPlugin
//  BrowserManager.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation

public struct PeerAvailability {
    public let peerIdentifier: PeerIdentifier
    public let available: Bool
}

//class for managing Thali browser's logic
public final class BrowserManager: NSObject {
    private let socketRelay = SocketRelay<BrowserVirtualSocketBuilder>()

    internal private(set) var currentBrowser: Browser?
    internal private(set) var availablePeers: Atomic<[PeerIdentifier]> = Atomic([])

    internal let serviceType: String

    public var peersAvailabilityChanged: (([PeerAvailability]) -> Void)? = nil
    public var listening: Bool {
        return currentBrowser?.listening ?? false
    }

    public init(serviceType: String) {
        self.serviceType = serviceType
    }

    private func handleFoundPeer(with identifier: PeerIdentifier) {
        peersAvailabilityChanged?([PeerAvailability(peerIdentifier: identifier, available: true)])
        availablePeers.modify {
            $0.append(identifier)
        }
    }

    private func handleLostPeer(with identifier: PeerIdentifier) {
        peersAvailabilityChanged?([PeerAvailability(peerIdentifier: identifier, available: false)])
        availablePeers.modify {
            if let index = $0.indexOf(identifier) {
                $0.removeAtIndex(index)
            }
        }
    }

    public func startListeningForAdvertisements() {
        if currentBrowser != nil {
            return
        }
        let browser = Browser(serviceType: serviceType,
                              foundPeer: handleFoundPeer, lostPeer: handleLostPeer)
        browser.startListening()
        self.currentBrowser = browser
    }

    public func stopListeningForAdvertisements() {
        currentBrowser?.stopListening()
        self.currentBrowser = nil
    }

    public func connectToPeer(identifier: PeerIdentifier, completion: (UInt16?, ErrorType?) -> Void) {
        guard let currentBrowser = self.currentBrowser else {
            completion(nil, ThaliCoreError.StartListeningNotActive)
            return
        }
        guard let lastGenerationIdentifier = self.lastGenerationPeer(for: identifier) else {
            completion(nil, ThaliCoreError.IllegalPeerID)
            return
        }
        do {
            let session = try currentBrowser.inviteToConnectPeer(with: lastGenerationIdentifier)
            socketRelay.createSocket(with: session, completion: completion)
        } catch let error {
            completion(nil, error)
        }
    }

    func lastGenerationPeer(for identifier: PeerIdentifier) -> PeerIdentifier? {
        return availablePeers.withValue {
            $0.filter {
                $0.uuid == identifier.uuid
                }
                .maxElement {
                    $0.0.generation < $0.1.generation
            }
        }
    }
}
