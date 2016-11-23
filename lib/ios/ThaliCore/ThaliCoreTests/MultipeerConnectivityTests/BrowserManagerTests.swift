//
//  Thali CordovaPlugin
//  BrowserManagerTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

@testable import ThaliCore
import XCTest

class BrowserManagerTests: XCTestCase {

  // MARK: - State
  var advertiserManager: AdvertiserManager!
  var browserManager: BrowserManager!
  var serviceType: String!

  let disposeTimeout: TimeInterval = 2.0
  let peerAvailabilityHandlerTimeout: TimeInterval = 5.0
  let getErrorOnStartListeningTimeout: TimeInterval = 5.0
  let creatingMPCFSessionTimeout: TimeInterval = 5.0
  let browserConnectTimeout: TimeInterval = 10.0

  // MARK: - Setup & Teardown
  override func setUp() {
    super.setUp()
    serviceType = String.randomValidServiceType(length: 7)
    advertiserManager = AdvertiserManager(serviceType: serviceType,
                                          disposeAdvertiserTimeout: disposeTimeout)

    browserManager = BrowserManager(serviceType: serviceType,
                                    inputStreamReceiveTimeout: 1) { peers in }
  }

  override func tearDown() {
    browserManager.stopListeningForAdvertisements()
    browserManager = nil
    advertiserManager.stopAdvertising()
    advertiserManager = nil
    serviceType = nil
    super.tearDown()
  }

  // MARK: - Tests
  func testStartListeningChangesListeningState() {
    // When
    browserManager.startListeningForAdvertisements(unexpectedErrorHandler)

    // Then
    XCTAssertTrue(browserManager.listening)
  }

  func testStopListeningWithoutCallingStartIsNOTError() {
    // When
    browserManager.stopListeningForAdvertisements()

    // Then
    XCTAssertFalse(browserManager.listening)
  }

  func testStopListeningTwiceWithoutCallingStartIsNOTError() {
    // When
    browserManager.stopListeningForAdvertisements()
    browserManager.stopListeningForAdvertisements()

    // Then
    XCTAssertFalse(browserManager.listening)
  }

  func testStopListeningChangesListeningState() {
    browserManager.startListeningForAdvertisements(unexpectedErrorHandler)
    XCTAssertTrue(browserManager.listening)

    // When
    browserManager.stopListeningForAdvertisements()

    // Then
    XCTAssertFalse(browserManager.listening)
  }

  func testStartStopStartListeningChangesListeningState() {
    // When
    browserManager.startListeningForAdvertisements(unexpectedErrorHandler)
    // Then
    XCTAssertTrue(browserManager.listening)

    // When
    browserManager.stopListeningForAdvertisements()
    // Then
    XCTAssertFalse(browserManager.listening)

    // When
    browserManager.startListeningForAdvertisements(unexpectedErrorHandler)
    // Then
    XCTAssertTrue(browserManager.listening)
  }

  func testStartListeningCalledTwiceChangesStateProperly() {
    // When
    browserManager.startListeningForAdvertisements(unexpectedErrorHandler)
    browserManager.startListeningForAdvertisements(unexpectedErrorHandler)

    // Then
    XCTAssertTrue(browserManager.listening)
  }

  func testStopListeningCalledTwiceChangesStateProperly() {
    // When
    browserManager.startListeningForAdvertisements(unexpectedErrorHandler)
    // Then
    XCTAssertTrue(browserManager.listening)

    // When
    browserManager.stopListeningForAdvertisements()
    browserManager.stopListeningForAdvertisements()
    // Then
    XCTAssertFalse(browserManager.listening)
  }

  func testConnectToPeerWithoutListeningReturnStartListeningNotActiveError() {
    // Expectations
    let getStartListeningNotActiveError =
      expectation(description: "got startListening not active error")

    // Given
    var connectionError: ThaliCoreError?
    XCTAssertFalse(browserManager.listening)

    // When
    browserManager.connectToPeer(Peer().uuid, syncValue: "0") {
      [weak getStartListeningNotActiveError] syncValue, error, port in
      if let error = error as? ThaliCoreError {
        connectionError = error
        getStartListeningNotActiveError?.fulfill()
      }
    }

    // Then
    waitForExpectations(timeout: getErrorOnStartListeningTimeout, handler: nil)
    XCTAssertEqual(connectionError, .StartListeningNotActive)
  }

  func testConnectToWrongPeerReturnsIllegalPeerIDError() {
    // Expectations
    let getIllegalPeerIDError = expectation(description: "get Illegal Peer")

    // Given
    var connectionError: ThaliCoreError?
    browserManager.startListeningForAdvertisements(unexpectedErrorHandler)

    // When
    let notDiscoveredPeer = Peer()
    browserManager.connectToPeer(notDiscoveredPeer.uuid, syncValue: "0") {
      [weak getIllegalPeerIDError] syncValue, error, port in
      if let error = error as? ThaliCoreError {
        connectionError = error
        getIllegalPeerIDError?.fulfill()
      }
    }

    // Then
    let getIllegalPeerTimeout: TimeInterval = 5
    waitForExpectations(timeout: getIllegalPeerTimeout, handler: nil)
    XCTAssertEqual(connectionError, .ConnectionFailed)
  }

  func testPickLatestGenerationAdvertiserOnConnect() {
    // Expectations
    let foundTwoAdvertisers = expectation(description: "found two advertisers")

    // Given
    let port1: UInt16 = 42
    let port2: UInt16 = 43

    var foundedAdvertisersCount = 0
    let expectedAdvertisersCount = 2

    // Starting 1st generation of advertiser
    advertiserManager.startUpdateAdvertisingAndListening(onPort: port1,
                                                         errorHandler: unexpectedErrorHandler)
    guard let firstGenerationAdvertiserIdentifier =
      advertiserManager.advertisers.value.last?.peer else {
        XCTFail("Advertiser manager must have at least one advertiser")
        return
    }

    // Starting 2nd generation of advertiser
    advertiserManager.startUpdateAdvertisingAndListening(onPort: port2,
                                                         errorHandler: unexpectedErrorHandler)
    guard let secondGenerationAdvertiserIdentifier =
      advertiserManager.advertisers.value.last?.peer else {
        XCTFail("Advertiser manager must have at least one advertiser")
        return
    }

    let browserManager = BrowserManager(
      serviceType: serviceType,
      inputStreamReceiveTimeout: 1,
      peerAvailabilityChanged: {
        [weak foundTwoAdvertisers] peerAvailability in

        if let
          availability = peerAvailability.first,
          availability.peerIdentifier == secondGenerationAdvertiserIdentifier.uuid {
          foundedAdvertisersCount += 1
          if foundedAdvertisersCount == expectedAdvertisersCount {
            foundTwoAdvertisers?.fulfill()
          }
        }
      })

    // When
    browserManager.startListeningForAdvertisements(unexpectedErrorHandler)

    // Then
    waitForExpectations(timeout: peerAvailabilityHandlerTimeout, handler: nil)
    let lastGenerationOfAdvertiserPeer =
      browserManager.lastGenerationPeer(for: firstGenerationAdvertiserIdentifier.uuid)

    XCTAssertEqual(lastGenerationOfAdvertiserPeer?.generation,
                   secondGenerationAdvertiserIdentifier.generation)

    // Cleanup
    browserManager.stopListeningForAdvertisements()
  }

  func testReceivedPeerAvailabilityEventAfterFoundAdvertiser() {
    // Expectations
    let foundPeer = expectation(description: "found peer advertiser's identifier")

    // Given
    var advertiserPeerAvailability: PeerAvailability? = nil
    advertiserManager.startUpdateAdvertisingAndListening(onPort: 42,
                                                         errorHandler: unexpectedErrorHandler)

    // When
    let browserManager = BrowserManager(serviceType: serviceType,
                                        inputStreamReceiveTimeout: 1,
                                        peerAvailabilityChanged: {
                                          [weak foundPeer] peerAvailability in
                                          advertiserPeerAvailability = peerAvailability.first
                                          foundPeer?.fulfill()
                                        })
    browserManager.startListeningForAdvertisements(unexpectedErrorHandler)

    // Then
    waitForExpectations(timeout: peerAvailabilityHandlerTimeout, handler: nil)

    if let advertiser = advertiserManager.advertisers.value.first {
      XCTAssertEqual(advertiserPeerAvailability?.available, true)
      XCTAssertEqual(advertiser.peer.uuid, advertiserPeerAvailability?.peerIdentifier)
    } else {
      XCTFail("AdvertiserManager does not have any advertisers")
    }

    // Cleanup
    browserManager.stopListeningForAdvertisements()
  }

  func testIncrementAvailablePeersWhenFoundPeer() {
    // Expectations
    let MPCFConnectionCreated = expectation(description: "MPCF connection is created")

    // Given
    let (advertiserManager, browserManager) = createMPCFPeers {
      peerAvailability in
      MPCFConnectionCreated.fulfill()
    }

    // When
    waitForExpectations(timeout: creatingMPCFSessionTimeout, handler: nil)

    // Then
    XCTAssertEqual(1,
                   browserManager.availablePeers.value.count,
                   "BrowserManager has not available peers")

    // Cleanup
    browserManager.stopListeningForAdvertisements()
    advertiserManager.stopAdvertising()
  }

  func testPeerAvailabilityChangedAfterStartAdvertising() {
    // Expectations
    let peerAvailabilityChangedToTrue =
      expectation(description: "PeerAvailability changed to true")

    // Given
    var advertiserPeerAvailability: PeerAvailability? = nil

    let browserManager = BrowserManager(
      serviceType: serviceType,
      inputStreamReceiveTimeout: 1,
      peerAvailabilityChanged: {
        [weak peerAvailabilityChangedToTrue] peerAvailability in

        if let peerAvailability = peerAvailability.first {
          if peerAvailability.available {
            // When
            advertiserPeerAvailability = peerAvailability
            peerAvailabilityChangedToTrue?.fulfill()
          }
        }
      })

    browserManager.startListeningForAdvertisements(unexpectedErrorHandler)
    advertiserManager.startUpdateAdvertisingAndListening(onPort: 42,
                                                         errorHandler: unexpectedErrorHandler)

    // Then
    waitForExpectations(timeout: peerAvailabilityHandlerTimeout, handler: nil)
    XCTAssertEqual(advertiserManager.advertisers.value.first!.peer.uuid,
                   advertiserPeerAvailability?.peerIdentifier)

    // Cleanup
    browserManager.stopListeningForAdvertisements()
  }

  func testPeerAvailabilityChangedAfterStopAdvertising() {
    // Expectations
    let peerAvailabilityChangedToFalse =
      expectation(description: "PeerAvailability changed to false")

    // Given
    let browserManager = BrowserManager(
      serviceType: serviceType,
      inputStreamReceiveTimeout: 1,
      peerAvailabilityChanged: {
        [weak advertiserManager, weak peerAvailabilityChangedToFalse]
        peerAvailability in

        if let peerAvailability = peerAvailability.first {
          if peerAvailability.available {
            // When
            advertiserManager?.stopAdvertising()
          } else {
            peerAvailabilityChangedToFalse?.fulfill()
          }
        }
      })

    browserManager.startListeningForAdvertisements(unexpectedErrorHandler)
    advertiserManager.startUpdateAdvertisingAndListening(onPort: 42,
                                                         errorHandler: unexpectedErrorHandler)

    // Then
    waitForExpectations(timeout: peerAvailabilityHandlerTimeout, handler: nil)

    // Cleanup
    browserManager.stopListeningForAdvertisements()
  }

  func testConnectToPeerMethodReturnsTCPPort() {
    // Expectations
    var MPCFBrowserFoundAdvertiser: XCTestExpectation?
    var TCPSocketSuccessfullyCreated: XCTestExpectation?

    // Given
    // Prepare pair of advertiser and browser
    MPCFBrowserFoundAdvertiser =
      expectation(description: "Browser peer found Advertiser peer")

    // Start listening for advertisements on browser
    let browserManager = BrowserManager(serviceType: serviceType,
                                        inputStreamReceiveTimeout: 5,
                                        peerAvailabilityChanged: {
                                          peerAvailability in

                                          guard let peer = peerAvailability.first else {
                                            XCTFail("Browser didn't find Advertiser peer")
                                            return
                                          }
                                          XCTAssertTrue(peer.available)
                                          MPCFBrowserFoundAdvertiser?.fulfill()
                                        })
    browserManager.startListeningForAdvertisements(unexpectedErrorHandler)

    // Start advertising on advertiser
    let advertiserManager = AdvertiserManager(serviceType: serviceType,
                                              disposeAdvertiserTimeout: disposeTimeout)
    advertiserManager.startUpdateAdvertisingAndListening(onPort: 0,
                                                         errorHandler: unexpectedErrorHandler)

    waitForExpectations(timeout: browserConnectTimeout) {
      error in
      MPCFBrowserFoundAdvertiser = nil
    }

    TCPSocketSuccessfullyCreated = expectation(description: "Browser has returned TCP socket")

    // When
    let peerToConnect = browserManager.availablePeers.value.first!
    browserManager.connectToPeer(peerToConnect.uuid, syncValue: "0") {
      syncValue, error, port in

      guard error == nil else {
        XCTFail("Error during connection: \(error.debugDescription)")
        return
      }

      TCPSocketSuccessfullyCreated?.fulfill()
    }

    // Then
    waitForExpectations(timeout: browserConnectTimeout) {
      error in
      guard error == nil else {
        XCTFail("Browser couldn't connect to peer")
        return
      }
      browserManager.stopListeningForAdvertisements()
      TCPSocketSuccessfullyCreated = nil
    }

    // Cleanup
    browserManager.stopListeningForAdvertisements()
    advertiserManager.stopAdvertising()
  }
}
