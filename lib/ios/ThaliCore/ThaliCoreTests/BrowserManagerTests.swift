//
//  Thali CordovaPlugin
//  BrowserManagerTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license
//  information.
//

import XCTest
@testable import ThaliCore

class BrowserManagerTests: XCTestCase {
    var serviceType: String!

    override func setUp() {
        serviceType = String.random(length: 7)
    }

    func testStartStopListeningChangesListeningState() {
        let browserManager = BrowserManager(serviceType: serviceType,
                                            inputStreamReceiveTimeout: 1) { peers in }
        browserManager.startListeningForAdvertisements { _ in }

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
        var connectError: MultiConnectError?

        // Precondition
        XCTAssertFalse(browserManager.listening)

        browserManager.connectToPeer(PeerIdentifier()) {
            [weak getErrorOnStartListeningExpectation] port, error in
            if let error = error as? MultiConnectError {
                connectError = error
                getErrorOnStartListeningExpectation?.fulfill()
            }
        }
        let getErrorOnStartListeningTimeout: Double = 5
        waitForExpectationsWithTimeout(getErrorOnStartListeningTimeout, handler: nil)

        // Should
        XCTAssertEqual(connectError, .StartListeningNotActive)
    }

    func testConnectToIllegalPeerReturnError() {
        let getIllegalPeerExpectation = expectationWithDescription("get Illegal Peer")
        var connectError: MultiConnectError?
        let browserManager = BrowserManager(serviceType: serviceType,
                                            inputStreamReceiveTimeout: 1) { peers in }
        // Precondition
        let notDiscoveredPeerIdentifier = PeerIdentifier()

        browserManager.startListeningForAdvertisements { _ in }
        browserManager.connectToPeer(notDiscoveredPeerIdentifier) {
            [weak getIllegalPeerExpectation] port, error in
            if let error = error as? MultiConnectError {
                connectError = error
                getIllegalPeerExpectation?.fulfill()
            }
        }

        // Should
        let getIllegalPeerTimeout: Double = 5
        waitForExpectationsWithTimeout(getIllegalPeerTimeout, handler: nil)
        XCTAssertEqual(connectError, .IllegalPeerID)
    }

    func testLostPeer() {
        let lostPeerExpectation = expectationWithDescription("lost peer advertiser's identifier")
        var advertiserPeerAvailability: PeerAvailability? = nil
        let advertiserManager = AdvertiserManager(serviceType: serviceType,
                                                  disposeAdvertiserTimeout: 30,
                                                  inputStreamReceiveTimeout: 1)
        let browserManager = BrowserManager(serviceType: serviceType,
                                            inputStreamReceiveTimeout: 1) { peerAvailability in
            if let availability = peerAvailability.first
                where availability.available == false {
                advertiserPeerAvailability = availability
                lostPeerExpectation.fulfill()
            }
        }

        browserManager.startListeningForAdvertisements(errorHandler)

        advertiserManager.startUpdateAdvertisingAndListening(withPort: 42,
                                                             errorHandler: errorHandler)
        let advertiserIdentifier = advertiserManager.currentAdvertiser?.peerIdentifier

        let delayTime = dispatch_time(DISPATCH_TIME_NOW, Int64(2 * Double(NSEC_PER_SEC)))
        dispatch_after(delayTime, dispatch_get_main_queue()) {
            advertiserManager.stopAdvertising()
        }

        waitForExpectationsWithTimeout(10, handler: nil)
        XCTAssertEqual(advertiserIdentifier, advertiserPeerAvailability?.peerIdentifier)
    }

    func testReceivedPeerAvailabilityEventAfterFoundAdvertiser() {
        let expectation = expectationWithDescription("found peer advertiser's identifier")
        var advertiserPeerAvailability: PeerAvailability? = nil
        let advertiserManager = AdvertiserManager(serviceType: serviceType,
                                                  disposeAdvertiserTimeout: 20,
                                                  inputStreamReceiveTimeout: 1)
        let browserManager = BrowserManager(serviceType: serviceType,
                                            inputStreamReceiveTimeout: 1) {
                                                [weak expectation] peerAvailability in
            advertiserPeerAvailability = peerAvailability.first
            expectation?.fulfill()
        }

        browserManager.startListeningForAdvertisements(errorHandler)
        advertiserManager.startUpdateAdvertisingAndListening(withPort: 42,
                                                             errorHandler: errorHandler)
        let advertiserIdentifier = advertiserManager.currentAdvertiser?.peerIdentifier

        waitForExpectationsWithTimeout(20, handler: nil)

        XCTAssertEqual(advertiserPeerAvailability?.available, true)
        XCTAssertEqual(advertiserIdentifier, advertiserPeerAvailability?.peerIdentifier)
    }
}
