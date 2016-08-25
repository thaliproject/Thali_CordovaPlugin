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

public enum MultiСonnectError: ErrorType {
    case StartListeningNotActive
    case ConnectionFailed
    case ConnectionTimedOut
    case MaxConnectionsReached
    case NoNativeNonTCPSupport
    case NoAvailableTCPPorts
    case RadioTurnedOff
    case UnspecifiedRadioError
    case IllegalPeerID
}

//class for managing Thali browser's logic
public final class BrowserManager: NSObject {
    private let socketRelay = SocketRelay<BrowserVirtualSocketBuilder>()

    internal private (set) var currentBrowser: Browser?
    internal private(set) var availablePeers: [PeerIdentifier] = []

    internal let serviceType: String

    public var peersAvailabilityChanged: (([PeerAvailability]) -> Void)? = nil
    public var isListening: Bool {
        return currentBrowser?.listening ?? false
    }

    public init(serviceType: String) {
        self.serviceType = serviceType
    }

    private func handleFoundPeer(with identifier: PeerIdentifier) {
        peersAvailabilityChanged?([PeerAvailability(peerIdentifier: identifier, available: true)])
        availablePeers.append(identifier)
    }

    private func handleLostPeer(with identifier: PeerIdentifier) {
        peersAvailabilityChanged?([PeerAvailability(peerIdentifier: identifier, available: false)])
        if let index = availablePeers.indexOf(identifier) {
            availablePeers.removeAtIndex(index)
        }
    }

    public func startListeningForAdvertisements() {
        if let currentBrowser = currentBrowser {
            currentBrowser.stopListening()
        }
        let browser = Browser(serviceType: serviceType,
                              foundPeer: handleFoundPeer, lostPeer: handleLostPeer)
        browser.startListening()
        self.currentBrowser = browser
    }

    public func stopListeningForAdvertisements() {
        guard let currentBrowser = self.currentBrowser where currentBrowser.listening else {
            assert(false, "there is no active listener")
            return
        }
        currentBrowser.stopListening()
        self.currentBrowser = nil
    }

    public func connectToPeer(identifier: PeerIdentifier, completion: (UInt16?, ErrorType?) -> Void) {
        return synchronized(self) {
            guard let lastGenerationIdentifier = self.lastGenerationPeer(for: identifier),
                let currentBrowser = self.currentBrowser else {
                    completion(nil, MultiСonnectError.StartListeningNotActive)
                    return
            }
            do {
                let session = try currentBrowser.invitePeerToConnect(lastGenerationIdentifier)
                socketRelay.createSocket(with: session, completion: completion)
            } catch let error {
                completion(nil, error)
            }
        }

    }

    func lastGenerationPeer(for identifier: PeerIdentifier) -> PeerIdentifier? {
        return availablePeers
            .filter {
                $0.uuid == identifier.uuid
            }
            .maxElement {
                $0.0.generation < $0.1.generation
        }
    }
}
