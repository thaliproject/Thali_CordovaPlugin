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

    func testStopBrowsing() {
        let browserManager = BrowserManager(serviceType: serviceType,
                                            inputStreamReceiveTimeout: 1) { peers in }
        browserManager.startListeningForAdvertisements { _ in }
        XCTAssertNotNil(browserManager.currentBrowser)
        XCTAssertTrue(browserManager.listening)
        browserManager.stopListeningForAdvertisements()
        XCTAssertNil(browserManager.currentBrowser)
        XCTAssertFalse(browserManager.listening)
    }

    func testStartListeningNotActive() {
        let browserManager = BrowserManager(serviceType: serviceType,
                                            inputStreamReceiveTimeout: 1) { peers in }
        let expectation = expectationWithDescription("got startListening not active error")
        var connectError: MultiConnectError?
        browserManager.connectToPeer(PeerIdentifier()) { [weak expectation] port, error in
            if let error = error as? MultiConnectError {
                connectError = error
                expectation?.fulfill()
            }
        }
        waitForExpectationsWithTimeout(5, handler: nil)
        XCTAssertEqual(connectError, .StartListeningNotActive)
    }

    func testIllegalPeer() {
        let expectation = expectationWithDescription("got Illegal Peer")
        var connectError: MultiConnectError?
        let browserManager = BrowserManager(serviceType: serviceType,
                                            inputStreamReceiveTimeout: 1) { peers in }
        browserManager.startListeningForAdvertisements { _ in }
        browserManager.connectToPeer(PeerIdentifier()) { [weak expectation] port, error in
            if let error = error as? MultiConnectError {
                connectError = error
                expectation?.fulfill()
            }
        }
        waitForExpectationsWithTimeout(5, handler: nil)
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
            if let availability = peerAvailability.first where availability.available == false {
                advertiserPeerAvailability = availability
                lostPeerExpectation.fulfill()
            }
        }

        browserManager.startListeningForAdvertisements { _ in }

        advertiserManager.startUpdateAdvertisingAndListening(42) { _ in}
        let advertiserIdentifier = advertiserManager.currentAdvertiser?.peerIdentifier

        let delayTime = dispatch_time(DISPATCH_TIME_NOW, Int64(2 * Double(NSEC_PER_SEC)))
        dispatch_after(delayTime, dispatch_get_main_queue()) {
            advertiserManager.stopAdvertising()
        }

        waitForExpectationsWithTimeout(10, handler: nil)
        XCTAssertEqual(advertiserIdentifier, advertiserPeerAvailability?.peerIdentifier)
    }

    func testFoundAdvertiser() {
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

        browserManager.startListeningForAdvertisements { _ in }
        advertiserManager.startUpdateAdvertisingAndListening(42) { _ in}
        let advertiserIdentifier = advertiserManager.currentAdvertiser?.peerIdentifier

        waitForExpectationsWithTimeout(20, handler: nil)

        XCTAssertTrue(advertiserPeerAvailability?.available ?? false)
        XCTAssertEqual(advertiserIdentifier, advertiserPeerAvailability?.peerIdentifier)
    }
}
