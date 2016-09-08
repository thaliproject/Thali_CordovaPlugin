//
//  Thali CordovaPlugin
//  AdvertiserManagerTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license
//  information.
//

import XCTest
@testable import ThaliCore

class AdvertiserManagerTests: XCTestCase {
    var serviceType: String!
    var advertiserManager: AdvertiserManager!
    let disposeTimeout: Double = 4.0

    override func setUp() {
        serviceType = String.random(length: 7)
        advertiserManager = AdvertiserManager(serviceType: serviceType,
                                              disposeAdvertiserTimeout: disposeTimeout,
                                              inputStreamReceiveTimeout: 1)
    }

    override func tearDown() {
        advertiserManager.stopAdvertising()
        advertiserManager = nil
    }

    func testIsAdvertising() {
        XCTAssertFalse(advertiserManager.advertising)
        advertiserManager.startUpdateAdvertisingAndListening(withPort: 42) { _ in }
        XCTAssertTrue(advertiserManager.advertising)
    }

    func testDisposeAdvertiserAfterTimeout() {
        let port1: UInt16 = 42
        let port2: UInt16 = 43
        advertiserManager.startUpdateAdvertisingAndListening(withPort: port1) { _ in }
        XCTAssertEqual(advertiserManager.advertisers.value.count, 1)
        let firstAdvertiserIdentifier = advertiserManager.currentAdvertiser?.peerIdentifier

        advertiserManager.startUpdateAdvertisingAndListening(withPort: port2) { _ in}
        XCTAssertEqual(advertiserManager.advertisers.value.count, 2)
        let expectation = expectationWithDescription("advertiser removed after delay")
        advertiserManager.didRemoveAdvertiserWithIdentifierHandler = { [weak expectation] identifier in
            XCTAssertEqual(firstAdvertiserIdentifier, identifier)
            expectation?.fulfill()
        }

        waitForExpectationsWithTimeout(disposeTimeout + 1, handler: nil)
        XCTAssertEqual(advertiserManager.advertisers.value.count, 1)
    }

    func testPickLatestGenerationAdvertiserOnConnect() {
        let port1: UInt16 = 42
        let port2: UInt16 = 43
        let found2AdvertisersExpectation = expectationWithDescription("found 2 advertisers")
        var advertisersCount = 0

        advertiserManager.startUpdateAdvertisingAndListening(withPort: port1) { _ in }
        let identifier: PeerIdentifier! = advertiserManager.currentAdvertiser?.peerIdentifier

        let browser = BrowserManager(serviceType: serviceType, inputStreamReceiveTimeout: 1) {
            [weak found2AdvertisersExpectation] peerAvailability in
            if let availability = peerAvailability.first
                where availability.peerIdentifier.uuid == identifier.uuid {
                advertisersCount += 1
                if advertisersCount == 2 {
                    found2AdvertisersExpectation?.fulfill()
                }
            }
        }

        advertiserManager.startUpdateAdvertisingAndListening(withPort: port2) { _ in }
        browser.startListeningForAdvertisements { _ in }

        waitForExpectationsWithTimeout(disposeTimeout + 1, handler: nil)
        let lastGenerationIdentifier = browser.lastGenerationPeer(for: identifier)

        XCTAssertEqual(1, lastGenerationIdentifier?.generation)
    }

    func testStopAdvertising() {
        advertiserManager.startUpdateAdvertisingAndListening(withPort: 42) { _ in }
        XCTAssertEqual(advertiserManager.advertisers.value.count, 1)
        XCTAssertTrue(advertiserManager.advertising)
        advertiserManager.stopAdvertising()
        XCTAssertEqual(advertiserManager.advertisers.value.count, 0)
        XCTAssertFalse(advertiserManager.advertising)
    }
}
