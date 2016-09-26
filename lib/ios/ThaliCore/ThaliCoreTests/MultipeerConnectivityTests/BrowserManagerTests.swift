//
//  Thali CordovaPlugin
//  BrowserManagerTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import XCTest
@testable import ThaliCore

class BrowserManagerTests: XCTestCase {

    var serviceType: String!

    override func setUp() {
        serviceType = String.random(length: 7)
    }

    // MARK: - Tests
    func testStartListeningChangesListeningState() {
        // Given
        let browserManager = BrowserManager(serviceType: serviceType,
                                            inputStreamReceiveTimeout: 1) { peers in }

        // When
        browserManager.startListeningForAdvertisements(unexpectedErrorHandler)

        // Then
        XCTAssertTrue(browserManager.listening)
    }

    func testStopListeningChangesListeningState() {
        // Given
        let browserManager = BrowserManager(serviceType: serviceType,
                                            inputStreamReceiveTimeout: 1) { peers in }
        browserManager.startListeningForAdvertisements(unexpectedErrorHandler)
        XCTAssertTrue(browserManager.listening)

        // When
        browserManager.stopListeningForAdvertisements()

        // Then
        XCTAssertFalse(browserManager.listening)
    }

    func testConnectToPeerWithoutListeningReturnStartListeningNotActiveError() {
        // Given
        let browserManager = BrowserManager(serviceType: serviceType,
                                            inputStreamReceiveTimeout: 1) { peers in }

        let getStartListeningNotActiveErrorExpectation =
            expectationWithDescription("got startListening not active error")
        var connectionError: ThaliCoreError?

        XCTAssertFalse(browserManager.listening)

        // When
        browserManager.connectToPeer(PeerIdentifier(), syncValue: "0") {
            [weak getStartListeningNotActiveErrorExpectation] syncValue, error, port in
            if let error = error as? ThaliCoreError {
                connectionError = error
                getStartListeningNotActiveErrorExpectation?.fulfill()
            }
        }

        // Then
        let getErrorOnStartListeningTimeout: NSTimeInterval = 5
        waitForExpectationsWithTimeout(getErrorOnStartListeningTimeout, handler: nil)
        XCTAssertEqual(connectionError, .StartListeningNotActive)
    }

    func testConnectToWrongPeerReturnsIllegalPeerIDError() {
        // Given
        let browserManager = BrowserManager(serviceType: serviceType,
                                            inputStreamReceiveTimeout: 1) { peers in }
        let getIllegalPeerIDErrorExpectation = expectationWithDescription("get Illegal Peer")
        var connectionError: ThaliCoreError?

        browserManager.startListeningForAdvertisements(unexpectedErrorHandler)

        // When
        let notDiscoveredPeerIdentifier = PeerIdentifier()
        browserManager.connectToPeer(notDiscoveredPeerIdentifier, syncValue: "0") {
            [weak getIllegalPeerIDErrorExpectation] syncValue, error, port in
            if let error = error as? ThaliCoreError {
                connectionError = error
                getIllegalPeerIDErrorExpectation?.fulfill()
            }
        }

        // Then
        let getIllegalPeerTimeout: NSTimeInterval = 5
        waitForExpectationsWithTimeout(getIllegalPeerTimeout, handler: nil)
        XCTAssertEqual(connectionError, .IllegalPeerID)
    }

    func testPickLatestGenerationAdvertiserOnConnect() {
        // Given
        let port1: UInt16 = 42
        let port2: UInt16 = 43

        let disposeTimeout = 2.0
        var foundedAdvertisersCount = 0
        let expectedAdvertisersCount = 2
        let foundTwoAdvertisersExpectation = expectationWithDescription("found two advertisers")

        let advertiserManager = AdvertiserManager(serviceType: serviceType,
                                                  disposeAdvertiserTimeout: disposeTimeout,
                                                  inputStreamReceiveTimeout: 1)

        // Starting 1st generation of advertiser
        advertiserManager.startUpdateAdvertisingAndListening(onPort: port1,
                                                             errorHandler: unexpectedErrorHandler)
        let firstGenerationAdvertiserIdentifier =
            advertiserManager.advertisers.value.last?.peerIdentifier


        // Starting 2nd generation of advertiser
        advertiserManager.startUpdateAdvertisingAndListening(onPort: port2,
                                                             errorHandler: unexpectedErrorHandler)
        let secondGenerationAdvertiserIdentifier =
            advertiserManager.advertisers.value.last?.peerIdentifier

        let browserManager = BrowserManager(
            serviceType: serviceType,
            inputStreamReceiveTimeout: 1,
            peersAvailabilityChangedHandler: {
                [weak foundTwoAdvertisersExpectation] peerAvailability in

                if let
                    availability = peerAvailability.first
                    where
                        availability.peerIdentifier == secondGenerationAdvertiserIdentifier?.uuid {
                            foundedAdvertisersCount += 1
                            if foundedAdvertisersCount == expectedAdvertisersCount {
                                foundTwoAdvertisersExpectation?.fulfill()
                            }
                }
            })

        // When
        browserManager.startListeningForAdvertisements(unexpectedErrorHandler)

        // Then
        waitForExpectationsWithTimeout(disposeTimeout, handler: nil)
        let lastGenerationOfAdvertiserPeer =
            browserManager.lastGenerationPeerIdentifier(for: firstGenerationAdvertiserIdentifier!)

        XCTAssertEqual(lastGenerationOfAdvertiserPeer?.generation,
                       secondGenerationAdvertiserIdentifier?.generation)
    }

    func testReceivedPeerAvailabilityEventAfterFoundAdvertiser() {
        // Given
        let foundPeerExpectation = expectationWithDescription("found peer advertiser's identifier")

        var advertiserPeerAvailability: PeerAvailability? = nil
        let disposeAdvertiserTimeout = 2.0

        let advertiserManager =
            AdvertiserManager(serviceType: serviceType,
                              disposeAdvertiserTimeout: disposeAdvertiserTimeout,
                              inputStreamReceiveTimeout: 1)
        advertiserManager.startUpdateAdvertisingAndListening(onPort: 42,
                                                             errorHandler: unexpectedErrorHandler)
        // When
        let browserManager = BrowserManager(serviceType: serviceType,
                                            inputStreamReceiveTimeout: 1,
                                            peersAvailabilityChangedHandler: {
                                                [weak foundPeerExpectation] peerAvailability in
                                                advertiserPeerAvailability = peerAvailability.first
                                                foundPeerExpectation?.fulfill()
                                            })
        browserManager.startListeningForAdvertisements(unexpectedErrorHandler)

        // Then
        waitForExpectationsWithTimeout(disposeAdvertiserTimeout, handler: nil)

        if let advertiser = advertiserManager.advertisers.value.first {
            let advertiserPeerIdentifierUUID = advertiser.peerIdentifier.uuid
            XCTAssertEqual(advertiserPeerAvailability?.available, true)
            XCTAssertEqual(advertiserPeerIdentifierUUID, advertiserPeerAvailability?.peerIdentifier)
        } else {
            XCTFail("AdvertiserManager does not have any advertisers")
        }
    }

    func testIncrementAvailablePeersWhenFoundPeer() {
        // Given
        let peerIdentifier = PeerIdentifier()
        let MPCFConnectionCreatedExpectation =
            expectationWithDescription("MPCF connection is created.")

        let (advertiserManager, browserManager) =
            createMPCFConnection(advertiserIdentifier: peerIdentifier,
                                 completion: {
                                    peerAvailability in
                                    MPCFConnectionCreatedExpectation.fulfill()
            })

        // When
        let creatingMPCFSessionTimeout = 5.0
        waitForExpectationsWithTimeout(creatingMPCFSessionTimeout, handler: nil)

        // Then
        XCTAssertEqual(1,
                       browserManager.availablePeers.value.count,
                       "BrowserManager has not available peers.")

        browserManager.stopListeningForAdvertisements()
        advertiserManager.stopAdvertising()
    }

    func testConnectToPeerIncrementsActiveRelays() {
        // Given
        let peerIdentifier = PeerIdentifier()
        let MPCFConnectionCreatedExpectation =
            expectationWithDescription("MPCF connection is created.")

        let (advertiserManager, browserManager) =
            createMPCFConnection(advertiserIdentifier: peerIdentifier,
                                 completion: {
                                    peerAvailability in
                                    MPCFConnectionCreatedExpectation.fulfill()
            })

        let creatingMPCFSessionTimeout = 5.0
        waitForExpectationsWithTimeout(creatingMPCFSessionTimeout, handler: {
            error in

            if nil != error {
                XCTFail("Can not create MPCF connection and browse advertisers.")
            }
        })

        let multiResolvedConnectResolvedCalledExpectation =
            expectationWithDescription("connectToPeer method returns callback.")

        // When
        let peerToConnect = browserManager.availablePeers.value.first!
        browserManager.connectToPeer(peerToConnect, syncValue: "0") {
            syncValue, error, port in

            multiResolvedConnectResolvedCalledExpectation.fulfill()
        }

        let connectToPeerMethodReturnsCallbackTimeout = 5.0
        waitForExpectationsWithTimeout(connectToPeerMethodReturnsCallbackTimeout, handler: nil)

        // Then
        XCTAssertEqual(browserManager.activeRelays.value.count,
                       1,
                       "BrowserManager has not active Relay instances.")

        browserManager.stopListeningForAdvertisements()
        advertiserManager.stopAdvertising()
    }

    func testDisconnectDecrementsActiveRelays() {
        // Given
        var MPCFConnectionCreatedExpectation: XCTestExpectation? =
            expectationWithDescription("MPCF connection is created.")

        let (advertiserManager, browserManager) =
            createMPCFConnection(advertiserIdentifier: PeerIdentifier(),
                                 completion: {
                                    peerAvailability in
                                    MPCFConnectionCreatedExpectation?.fulfill()
            })

        let creatingMPCFSessionTimeout = 5.0
        waitForExpectationsWithTimeout(creatingMPCFSessionTimeout, handler: {
            error in

            if nil != error {
                XCTFail("Can not create MPCF connection and browse advertisers.")
            } else {
                MPCFConnectionCreatedExpectation = nil
            }
        })

        var multiConnectResolvedCalledAfterConnectExpectation: XCTestExpectation? =
            expectationWithDescription("connectToPeer method returns callback on connect.")
        var multiConnectResolvedCalledAfterDisconnectExpectation: XCTestExpectation? = nil

        let peerToConnect = browserManager.availablePeers.value.first!
        browserManager.connectToPeer(peerToConnect, syncValue: "0") {
            syncValue, error, port in

            multiConnectResolvedCalledAfterConnectExpectation?.fulfill()
            multiConnectResolvedCalledAfterDisconnectExpectation?.fulfill()
        }

        let multiConnectResolvedTimeout = 5.0
        waitForExpectationsWithTimeout(multiConnectResolvedTimeout, handler: {
            error in
            multiConnectResolvedCalledAfterConnectExpectation = nil
        })

        XCTAssertEqual(1,
                       browserManager.activeRelays.value.count,
                       "BrowserManager has not active Relay instances.")

        multiConnectResolvedCalledAfterDisconnectExpectation =
            expectationWithDescription("connectToPeer method returns callback on disconnect.")

        // When
        browserManager.disconnect(peerToConnect)

        waitForExpectationsWithTimeout(multiConnectResolvedTimeout, handler: {
            error in
            multiConnectResolvedCalledAfterDisconnectExpectation
        })

        // Then
        XCTAssertEqual(0,
                       browserManager.activeRelays.value.count,
                       "BrowserManager still has active Relay instances.")
    }

    func testDisconnectWrongPeerDoesNotDecrementAvailablePeers() {
        // Given
        var MPCFConnectionCreatedExpectation: XCTestExpectation? =
            expectationWithDescription("MPCF connection is created.")

        let (advertiserManager, browserManager) =
            createMPCFConnection(advertiserIdentifier: PeerIdentifier(),
                                 completion: {
                                    peerAvailability in
                                    MPCFConnectionCreatedExpectation?.fulfill()
            })

        let creatingMPCFSessionTimeout = 5.0
        waitForExpectationsWithTimeout(creatingMPCFSessionTimeout, handler: {
            error in

            if nil != error {
                XCTFail("Can not create MPCF connection and browse advertisers.")
            } else {
                MPCFConnectionCreatedExpectation = nil
            }
        })

        var multiConnectResolvedCalledAfterConnectExpectation: XCTestExpectation? =
            expectationWithDescription("connectToPeer method returns callback on connect.")

        let peerToConnect = browserManager.availablePeers.value.first!
        browserManager.connectToPeer(peerToConnect, syncValue: "0") {
            syncValue, error, port in
            multiConnectResolvedCalledAfterConnectExpectation?.fulfill()
        }

        let multiConnectResolvedTimeout = 5.0
        waitForExpectationsWithTimeout(multiConnectResolvedTimeout, handler: {
            error in
            multiConnectResolvedCalledAfterConnectExpectation = nil
        })

        XCTAssertEqual(1,
                       browserManager.activeRelays.value.count,
                       "BrowserManager has not active Relay instances.")


        // When
        let wrongPeerIdentifier = PeerIdentifier()
        browserManager.disconnect(wrongPeerIdentifier)

        // Then
        XCTAssertEqual(1,
                       browserManager.activeRelays.value.count,
                       "BrowserManager has not active Relay instances.")
    }

    func testPeerAvailabilityChangedAfterStartAdvertising() {
        // Given
        let peerAvailabilityChangedToTrueExpectation =
            expectationWithDescription("PeerAvailability changed to true")

        var advertiserPeerAvailability: PeerAvailability? = nil

        let advertiserManager = AdvertiserManager(serviceType: serviceType,
                                                  disposeAdvertiserTimeout: 2.0,
                                                  inputStreamReceiveTimeout: 1)

        let browserManager = BrowserManager(
            serviceType: serviceType,
            inputStreamReceiveTimeout: 1,
            peersAvailabilityChangedHandler: {
                [weak advertiserManager,
                weak peerAvailabilityChangedToTrueExpectation] peerAvailability in

                if let peerAvailability = peerAvailability.first {
                    if peerAvailability.available {
                        // When
                        advertiserPeerAvailability = peerAvailability
                        peerAvailabilityChangedToTrueExpectation?.fulfill()
                    }
                }
            })

        browserManager.startListeningForAdvertisements(unexpectedErrorHandler)
        advertiserManager.startUpdateAdvertisingAndListening(onPort: 42,
                                                             errorHandler: unexpectedErrorHandler)

        let advertiserPeerIdentifierUUID =
            advertiserManager.advertisers.value.first!.peerIdentifier.uuid

        // Then
        let peerAvailabilityHandlerTimeout = 10.0
        waitForExpectationsWithTimeout(peerAvailabilityHandlerTimeout, handler: nil)
        XCTAssertEqual(advertiserPeerIdentifierUUID, advertiserPeerAvailability?.peerIdentifier)
    }

    func testPeerAvailabilityChangedAfterStopAdvertising() {
        // Given
        let peerAvailabilityChangedToFalseExpectation =
            expectationWithDescription("PeerAvailability changed to false")

        var advertiserPeerAvailability: PeerAvailability? = nil

        let advertiserManager = AdvertiserManager(serviceType: serviceType,
                                                  disposeAdvertiserTimeout: 2.0,
                                                  inputStreamReceiveTimeout: 1)

        let browserManager = BrowserManager(
            serviceType: serviceType,
            inputStreamReceiveTimeout: 1,
            peersAvailabilityChangedHandler: {
                [weak advertiserManager,
                weak peerAvailabilityChangedToFalseExpectation] peerAvailability in

                if let peerAvailability = peerAvailability.first {
                    if peerAvailability.available {
                        // When
                        advertiserManager?.stopAdvertising()
                    } else {
                        advertiserPeerAvailability = peerAvailability
                        peerAvailabilityChangedToFalseExpectation?.fulfill()
                    }
                }
            })

        browserManager.startListeningForAdvertisements(unexpectedErrorHandler)
        advertiserManager.startUpdateAdvertisingAndListening(onPort: 42,
                                                             errorHandler: unexpectedErrorHandler)

        let advertiserPeerIdentifierUUID =
            advertiserManager.advertisers.value.first!.peerIdentifier.uuid

        // Then
        let peerAvailabilityHandlerTimeout = 10.0
        waitForExpectationsWithTimeout(peerAvailabilityHandlerTimeout, handler: nil)
        XCTAssertEqual(advertiserPeerIdentifierUUID, advertiserPeerAvailability?.peerIdentifier)
    }

    func testConnectToPeerMethodCreatesTCPSocket() {
        // Given
        var MPCFConnectionCreatedExpectation: XCTestExpectation? =
            expectationWithDescription("MPCF connection is created.")

        let peerIdentifier = PeerIdentifier()
        let (advertiserManager, browserManager) =
            createMPCFConnection(advertiserIdentifier: peerIdentifier,
                                 completion: {
                                    peerAvailability in
                                    MPCFConnectionCreatedExpectation?.fulfill()
                                 })

        let creatingMPCFSessionTimeout = 5.0
        waitForExpectationsWithTimeout(creatingMPCFSessionTimeout, handler: {
            error in

            if nil != error {
                XCTFail("Can not create MPCF connection and browse advertisers.")
            } else {
                MPCFConnectionCreatedExpectation = nil
            }
        })

        let TCPSocketSuccessfullyCreatedExpectation =
            expectationWithDescription("Waiting until TCP socket created.")

        // When
        let peerToConnect = browserManager.availablePeers.value.first!
        browserManager.connectToPeer(peerToConnect, syncValue: "0") {
            syncValue, error, port in

            if nil != error {
                XCTFail("Error during creation TCP socket that's listening for connections")
                return
            }

            TCPSocketSuccessfullyCreatedExpectation.fulfill()
        }

        // Then
        let creatingTCPSocketTimeout = 5.0
        waitForExpectationsWithTimeout(creatingTCPSocketTimeout, handler: nil)
    }
}
