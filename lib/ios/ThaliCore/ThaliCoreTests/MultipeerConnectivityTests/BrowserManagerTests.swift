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

    private func createSession() -> (AdvertiserManager, BrowserManager) {
        let foundPeerExpectation = expectationWithDescription("found advertiser's peer")
        var peerIdentifier: PeerIdentifier?

        let advertiserManager = AdvertiserManager(serviceType: serviceType,
                                                  disposeAdvertiserTimeout: 2.0,
                                                  inputStreamReceiveTimeout: 2.0)
        advertiserManager.startUpdateAdvertisingAndListening(withPort: 42,
                                                             errorHandler: unexpectedErrorHandler)

        let browserManager = BrowserManager(serviceType: serviceType,
                                            inputStreamReceiveTimeout: 2.0) {
                                                [weak foundPeerExpectation] peers in
                                                guard let peer = peers.first?.peerIdentifier
                                                    where peers.first?.available == true else {
                                                    return
                                                }
                                                foundPeerExpectation?.fulfill()
                                                peerIdentifier = peer
                                            }
        browserManager.startListeningForAdvertisements(unexpectedErrorHandler)
        let foundPeerTimeout = 2.0
        waitForExpectationsWithTimeout(foundPeerTimeout, handler: nil)
        guard let identifier = peerIdentifier else {
            XCTFail("peer identifier should be not nil")
            return (advertiserManager, browserManager)
        }
        let connectToAdvertiserPeer = expectationWithDescription("connected to peer identifier")
        browserManager.connectToPeer(identifier) { [weak connectToAdvertiserPeer] port, error in
            if let _ = error {
                return
            } else {
                connectToAdvertiserPeer?.fulfill()
            }
        }
        let connectToPeerTimeout = 2.0
        waitForExpectationsWithTimeout(connectToPeerTimeout, handler: nil)
        return (advertiserManager, browserManager)
    }

    func testStartStopListeningChangesListeningState() {
        let browserManager = BrowserManager(serviceType: serviceType,
                                            inputStreamReceiveTimeout: 1) { peers in }
        browserManager.startListeningForAdvertisements(unexpectedErrorHandler)

        // Precondition
        XCTAssertNotNil(browserManager.currentBrowser)
        XCTAssertTrue(browserManager.listening)

        browserManager.stopListeningForAdvertisements()

        // Should
        XCTAssertNil(browserManager.currentBrowser)
        XCTAssertFalse(browserManager.listening)
    }

    func testConnectWithoutListeningReturnStartListeningNotActiveError() {
        let browserManager = BrowserManager(serviceType: serviceType,
                                            inputStreamReceiveTimeout: 1) { peers in }
        let getErrorOnStartListeningExpectation =
            expectationWithDescription("got startListening not active error")
        var connectError: ThaliCoreError?

        // Precondition
        XCTAssertFalse(browserManager.listening)

        browserManager.connectToPeer(PeerIdentifier()) {
            [weak getErrorOnStartListeningExpectation] port, error in
            if let error = error as? ThaliCoreError {
                connectError = error
                getErrorOnStartListeningExpectation?.fulfill()
            }
        }
        let getErrorOnStartListeningTimeout: NSTimeInterval = 5
        waitForExpectationsWithTimeout(getErrorOnStartListeningTimeout, handler: nil)

        // Should
        XCTAssertEqual(connectError, .StartListeningNotActive)
    }

    func testConnectToIllegalPeerReturnError() {
        let getIllegalPeerExpectation = expectationWithDescription("get Illegal Peer")
        var connectError: ThaliCoreError?
        let browserManager = BrowserManager(serviceType: serviceType,
                                            inputStreamReceiveTimeout: 1) { peers in }
        // Precondition
        let notDiscoveredPeerIdentifier = PeerIdentifier()

        browserManager.startListeningForAdvertisements(unexpectedErrorHandler)
        browserManager.connectToPeer(notDiscoveredPeerIdentifier) {
            [weak getIllegalPeerExpectation] port, error in
            if let error = error as? ThaliCoreError {
                connectError = error
                getIllegalPeerExpectation?.fulfill()
            }
        }

        // Should
        let getIllegalPeerTimeout: NSTimeInterval = 5
        waitForExpectationsWithTimeout(getIllegalPeerTimeout, handler: nil)
        XCTAssertEqual(connectError, .IllegalPeerID)
    }

    func testLostPeerAfterStopAdvertising() {
        let lostPeerExpectation = expectationWithDescription("lost peer advertiser's identifier")
        var advertiserPeerAvailability: PeerAvailability? = nil
        let advertiserManager = AdvertiserManager(serviceType: serviceType,
                                                  disposeAdvertiserTimeout: 2.0,
                                                  inputStreamReceiveTimeout: 1)
        let browserManager = BrowserManager(serviceType: serviceType,
                                            inputStreamReceiveTimeout: 1) {
                                                [weak advertiserManager,
                                                weak lostPeerExpectation] peerAvailability in
            if let availability = peerAvailability.first {
                if availability.available {
                    advertiserManager?.stopAdvertising()
                } else {
                    advertiserPeerAvailability = availability
                    lostPeerExpectation?.fulfill()
                }
            }
        }

        browserManager.startListeningForAdvertisements(unexpectedErrorHandler)
        advertiserManager.startUpdateAdvertisingAndListening(withPort: 42,
                                                             errorHandler: unexpectedErrorHandler)
        let advertiserIdentifier = advertiserManager.currentAdvertiser?.peerIdentifier

        let lostPeerTimeout = 10.0
        waitForExpectationsWithTimeout(lostPeerTimeout, handler: nil)
        XCTAssertEqual(advertiserIdentifier, advertiserPeerAvailability?.peerIdentifier)
    }

    func testReceivedPeerAvailabilityEventAfterFoundAdvertiser() {
        let disposeAdvertiserTimeout = 2.0
        let expectation = expectationWithDescription("found peer advertiser's identifier")
        var advertiserPeerAvailability: PeerAvailability? = nil
        let advertiserManager =
            AdvertiserManager(serviceType: serviceType,
                              disposeAdvertiserTimeout: disposeAdvertiserTimeout,
                              inputStreamReceiveTimeout: 1)
        let browserManager = BrowserManager(serviceType: serviceType,
                                            inputStreamReceiveTimeout: 1) {
                                                [weak expectation] peerAvailability in
            advertiserPeerAvailability = peerAvailability.first
            expectation?.fulfill()
        }

        browserManager.startListeningForAdvertisements(unexpectedErrorHandler)
        advertiserManager.startUpdateAdvertisingAndListening(withPort: 42,
                                                             errorHandler: unexpectedErrorHandler)
        let advertiserIdentifier = advertiserManager.currentAdvertiser?.peerIdentifier

        waitForExpectationsWithTimeout(disposeAdvertiserTimeout, handler: nil)

        XCTAssertEqual(advertiserPeerAvailability?.available, true)
        XCTAssertEqual(advertiserIdentifier, advertiserPeerAvailability?.peerIdentifier)
    }

    func testPickLatestGenerationAdvertiserOnConnect() {
        let port1: UInt16 = 42
        let port2: UInt16 = 43
        let found2AdvertisersExpectation = expectationWithDescription("found 2 advertisers")
        var advertisersCount = 0
        let disposeTimeout = 2.0
        let expectedAdvertisersCount = 2

        let advertiserManager = AdvertiserManager(serviceType: serviceType,
                                              disposeAdvertiserTimeout: disposeTimeout,
                                              inputStreamReceiveTimeout: 1)

        // Starting 1st generation of advertiser
        advertiserManager.startUpdateAdvertisingAndListening(withPort: port1,
                                                            errorHandler: unexpectedErrorHandler)
        let firstGenerationAdvertiserIdentifier: PeerIdentifier! =
            advertiserManager.currentAdvertiser?.peerIdentifier
        // Starting 2nd generation of advertiser
        advertiserManager.startUpdateAdvertisingAndListening(withPort: port2,
                                                             errorHandler: unexpectedErrorHandler)
        let secondGenerationAdvertiserIdentifier =
            advertiserManager.currentAdvertiser?.peerIdentifier
        let browser = BrowserManager(serviceType: serviceType, inputStreamReceiveTimeout: 1) {
            [weak found2AdvertisersExpectation] peerAvailability in
            if let availability = peerAvailability.first
                where availability.peerIdentifier.uuid == firstGenerationAdvertiserIdentifier.uuid {
                advertisersCount += 1
                if advertisersCount == expectedAdvertisersCount {
                    found2AdvertisersExpectation?.fulfill()
                }
            }
        }

        browser.startListeningForAdvertisements(unexpectedErrorHandler)
        waitForExpectationsWithTimeout(disposeTimeout, handler: nil)
        let lastGenerationPeer =
            browser.lastGenerationPeer(for: firstGenerationAdvertiserIdentifier)

        XCTAssertEqual(lastGenerationPeer?.generation,
                       secondGenerationAdvertiserIdentifier?.generation)
    }

    func testDisconnectRemovesActiveSession() {
        let (advertiser, browser) = createSession()
        XCTAssertEqual(browser.activeSessions.value.count, 1)
        guard let peerIdentifier = advertiser.currentAdvertiser?.peerIdentifier else {
            XCTFail("advertiser manager should have active advertiser")
            return
        }
        browser.disconnect(peerIdentifier)
        XCTAssertEqual(browser.activeSessions.value.count, 0)
        browser.stopListeningForAdvertisements()
        advertiser.stopAdvertising()
    }

    func testDisconnectWrongIdentifierNotChangesActiveSessions() {
        let (advertiser, browser) = createSession()
        XCTAssertEqual(browser.activeSessions.value.count, 1)
        browser.disconnect(PeerIdentifier())
        XCTAssertEqual(browser.activeSessions.value.count, 1)
        browser.stopListeningForAdvertisements()
        advertiser.stopAdvertising()
    }

}
