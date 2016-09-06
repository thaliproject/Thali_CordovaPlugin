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
        advertiserManager = AdvertiserManager(serviceType: serviceType, disposeAdvertiserTimeout: disposeTimeout)
    }

    override func tearDown() {
        advertiserManager.stopAdvertising()
        advertiserManager = nil
    }

    func testStartAdvertising() {
        XCTAssertFalse(advertiserManager.advertising)
        advertiserManager.startUpdateAdvertisingAndListening(42)
        XCTAssertTrue(advertiserManager.advertising)
    }

    func testDisposeAdvertiserAfterTimeout() {
        advertiserManager.startUpdateAdvertisingAndListening(42)
        XCTAssertEqual(advertiserManager.advertisers.value.count, 1)
        let firstAdvertiserIdentifier = advertiserManager.currentAdvertiser?.peerIdentifier

        advertiserManager.startUpdateAdvertisingAndListening(4242)
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
        let found2AdvertisersExpectation = expectationWithDescription("found 2 advertisers")
        var advertisersCount = 0

        advertiserManager.startUpdateAdvertisingAndListening(42)
        let identifier: PeerIdentifier! = advertiserManager.currentAdvertiser?.peerIdentifier

        let browser = BrowserManager(serviceType: serviceType) { [weak found2AdvertisersExpectation] peerAvailability in
            if let availability = peerAvailability.first where availability.peerIdentifier.uuid == identifier.uuid {
                advertisersCount += 1
                if advertisersCount == 2 {
                    found2AdvertisersExpectation?.fulfill()
                }
            }
        }

        advertiserManager.startUpdateAdvertisingAndListening(43)
        browser.startListeningForAdvertisements { _ in }

        waitForExpectationsWithTimeout(disposeTimeout + 1, handler: nil)
        let lastGenerationIdentifier = browser.lastGenerationPeer(for: identifier)

        XCTAssertEqual(1, lastGenerationIdentifier?.generation)
    }

    func testStopAdvertising() {
        advertiserManager.startUpdateAdvertisingAndListening(42)
        XCTAssertEqual(advertiserManager.advertisers.value.count, 1)
        XCTAssertTrue(advertiserManager.advertising)
        advertiserManager.stopAdvertising()
        XCTAssertEqual(advertiserManager.advertisers.value.count, 0)
        XCTAssertFalse(advertiserManager.advertising)
    }
}
