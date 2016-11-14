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

  /**
   Bool flag indicates if `BrowserManager` object is listening for advertisements.
   */
  public var listening: Bool {
    return currentBrowser?.listening ?? false
  }

  // MARK: - Internal state

  /**
   `Peer` objects that can be invited into the session.
   */
  internal private(set) var availablePeers: Atomic<[Peer]> = Atomic([])

  /**
   Active `Relay` objects.
   */
  internal private(set) var activeRelays: Atomic<[String: BrowserRelay]> = Atomic([:])

  // MARK: - Private state

  /**
   Currently active `Browser` object.
   */
  private var currentBrowser: Browser?

  /**
   The type of service to browse.
   */
  private let serviceType: String

  /**
   Invite timeout after which the session between peers can be treated as failed.
   */
  private let inputStreamReceiveTimeout: NSTimeInterval

  /**
   Handle change of peer availability.
   */
  private let peerAvailabilityChangedHandler: ([PeerAvailability]) -> Void

  // MARK: - Public state

  /**
   Returns a new `BrowserManager` object.

   - parameters:
     - serviceType:
       The type of service to browse.

     - inputStreamReceiveTimeout:
       Invite timeout after which the session between peers can be treated as failed.
   
     - peerAvailabilityChangedHandler:
       Called when PeerAvailability is changed.

   - returns:
     An initialized `BrowserManager` object.
   */
  public init(serviceType: String,
              inputStreamReceiveTimeout: NSTimeInterval,
              peerAvailabilityChanged: ([PeerAvailability]) -> Void) {
    self.serviceType = serviceType
    self.peerAvailabilityChangedHandler = peerAvailabilityChanged
    self.inputStreamReceiveTimeout = inputStreamReceiveTimeout
  }

  // MARK: - Public methods

  /**
   This method instructs to discover what other devices are within range.
   
   - parameters:
     - errorHandler:
       Called when advertisement fails.
   */
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

  /**
   Stops listening for advertisements.
   */
  public func stopListeningForAdvertisements() {
    currentBrowser?.stopListening()
    currentBrowser = nil
  }

  /**
   Establish a non-TCP/IP connection to the identified peer and then create a
   TCP/IP bridge on top of that connection which can be accessed by
   opening a TCP/IP connection to the port returned in the callback.
   
   - parameters:
     - peerIdentifier:
       A value mapped to the UUID part of the remote peer's MCPeerID.
     - syncValue:
       An opaque string that used for tracking callback calls.
     - completion:
       Called when connect succeeded or failed.
   */
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

                                        let relay = strongSelf.activeRelays.value[peerIdentifier]
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

  /**
   - parameters:
     - peerIdentifer:
       A value mapped to the UUID part of the remote peer's MCPeerID.
   */
  public func disconnect(peerIdentifer: String) {
    guard let relay = activeRelays.value[peerIdentifer] else {
      return
    }

    relay.disconnectNonTCPSession()
  }

  // MARK: - Internal methods

  /**
   Returns the highest generation advertised for given peerIdentifier.

   - parameters:
     - peerIdentifier:
       A value mapped to the UUID part of the remote peer's MCPeerID.

   - returns:
     `Peer` object with the highest generation advertised for given *peerIdentifier*.
     If there are no peers with given *peerIdentifier*, return nil.
   */
  func lastGenerationPeer(for peerIdentifier: String) -> Peer? {
    return availablePeers.withValue {
      $0
      .filter { $0.uuid == peerIdentifier }
      .maxElement { $0.0.generation < $0.1.generation }
    }
  }

  // MARK: - Private handlers

  /**
   Handle finding nearby peer.

   - parameters:
     - peer:
       `Peer` object which was founded.
   */
  private func handleFound(peer: Peer) {
    availablePeers.modify { $0.append(peer) }

    let updatedPeerAvailability = PeerAvailability(peer: peer, available: true)
    peerAvailabilityChangedHandler([updatedPeerAvailability])
  }

  /**
   Handle losing nearby peer.

   - parameters:
     - peer:
       `Peer` object which was lost.
   */
  private func handleLost(peer: Peer) {
    availablePeers.modify {
      if let indexOfLostPeer = $0.indexOf(peer) {
        $0.removeAtIndex(indexOfLostPeer)
      }
    }

    let updatedPeerAvailability = PeerAvailability(peer: peer, available: false)
    peerAvailabilityChangedHandler([updatedPeerAvailability])
  }
}
