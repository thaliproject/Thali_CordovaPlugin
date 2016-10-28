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

  /**
   Bool flag indicates if advertising is active.
   */
  public var advertising: Bool {
    return currentAdvertiser?.advertising ?? false
  }

  // MARK: - Internal state

  /**
   Active `Advertiser` objects.
   */
  internal fileprivate(set) var advertisers: Atomic<[Advertiser]> = Atomic([])

  /**
   Active `Relay` objects.
   */
  internal fileprivate(set) var activeRelays: Atomic<[String: AdvertiserRelay]> = Atomic([:])

  /**
   Handle disposing advertiser after timeout.
   */
  internal var didDisposeOfAdvertiserForPeerHandler: ((Peer) -> Void)?

  // MARK: - Private state

  /**
   Currently active `Advertiser` object.
   */
  fileprivate var currentAdvertiser: Advertiser?

  /**
   The type of service to advertise.
   */
  fileprivate let serviceType: String

  /**
   Timeout after which advertiser gets disposed of.
   */
  fileprivate let disposeTimeout: TimeInterval

  // MARK: - Initialization

  /**
   Returns a new `AdvertiserManager` object.

   - parameters:
     - serviceType:
       The type of service to advertise.

     - disposeAdvertiserTimeout:
       Timeout after which advertiser gets disposed of.

   - returns:
   An initialized `AdvertiserManager` object.
   */
  public init(serviceType: String, disposeAdvertiserTimeout: TimeInterval) {
    self.serviceType = serviceType
    self.disposeTimeout = disposeAdvertiserTimeout
  }

  // MARK: - Public methods

  /**
   This method has two separate but related functions.

   It's first function is to begin advertising the Thali peer's presence to other peers.

   The second purpose is to bridge outgoing non-TCP/IP connections to TCP/IP port.

   - parameters:
     - port:
       Pre-configured localhost port that a native TCP/IP client should
       use to bridge outgoing non-TCP/IP connection.

     - errorHandler:
       Called when startUpdateAdvertisingAndListening fails.
   */
  public func startUpdateAdvertisingAndListening(onPort port: UInt16,
                                                 errorHandler: @escaping (Error) -> Void) {
    if let currentAdvertiser = currentAdvertiser {
      disposeOfAdvertiserAfterTimeoutToFinishInvites(currentAdvertiser)
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
      errorHandler(ThaliCoreError.ConnectionFailed)
      return
    }

    advertisers.modify {
      newAdvertiser.startAdvertising(errorHandler)
      $0.append(newAdvertiser)
    }

    self.currentAdvertiser = newAdvertiser
  }

  /**
   Dispose of all advertisers.
   */
  public func stopAdvertising() {
    advertisers.modify {
      $0.forEach { $0.stopAdvertising() }
      $0.removeAll()
    }

    currentAdvertiser = nil
  }

  /**
   Checks if `AdvertiserManager` has advertiser with a given identifier.

   - parameters:
     - identifier:
       UUID part of the `Peer`.

   - returns:
     Bool value indicates if `AdvertiserManager` has advertiser with given identifier.
   */
  public func hasAdvertiser(with identifier: String) -> Bool {
    return advertisers.value.filter { $0.peer.uuid == identifier }
                            .count > 0
  }

  // MARK: - Private methods

  /**
   Disposes of advertiser after timeout.

   In any case when a peer starts a new underlying `MCNearbyServiceAdvertiser` object
   it MUST keep the old object for at least *disposeTimeout*.
   This is to allow any in progress invites to finish.
   After *disposeTimeout* the old `MCNearbyServiceAdvertiser` objects MUST be closed.
   */
  fileprivate func disposeOfAdvertiserAfterTimeoutToFinishInvites(
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

      strongSelf.didDisposeOfAdvertiserForPeerHandler?(advertiserShouldBeDisposed.peer)
    }
  }
}
