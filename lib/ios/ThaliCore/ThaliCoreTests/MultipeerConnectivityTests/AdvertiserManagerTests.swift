//
//  Thali CordovaPlugin
//  AdvertiserManagerTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import XCTest
@testable import ThaliCore

class AdvertiserManagerTests: XCTestCase {

    var serviceType: String!
    var advertiserManager: AdvertiserManager!
    let disposeTimeout: NSTimeInterval = 4.0

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
        advertiserManager.startUpdateAdvertisingAndListening(withPort: 42,
                                                             errorHandler: unexpectedErrorHandler)
        XCTAssertTrue(advertiserManager.advertising)
    }

    func testDisposeAdvertiserAfterTimeout() {
        let port1: UInt16 = 42
        let port2: UInt16 = 43
        advertiserManager.startUpdateAdvertisingAndListening(withPort: port1,
                                                             errorHandler: unexpectedErrorHandler)
        XCTAssertEqual(advertiserManager.advertisers.value.count, 1)
        let firstAdvertiserIdentifier = advertiserManager.currentAdvertiser?.peerIdentifier

        advertiserManager.startUpdateAdvertisingAndListening(withPort: port2,
                                                             errorHandler: unexpectedErrorHandler)
        XCTAssertEqual(advertiserManager.advertisers.value.count, 2)
        let expectation = expectationWithDescription("advertiser removed after delay")
        advertiserManager.didRemoveAdvertiserWithIdentifierHandler = {
            [weak expectation] identifier in
            XCTAssertEqual(firstAdvertiserIdentifier, identifier)
            expectation?.fulfill()
        }

        waitForExpectationsWithTimeout(disposeTimeout, handler: nil)
        XCTAssertEqual(advertiserManager.advertisers.value.count, 1)
    }

    func testStopAdvertising() {
        advertiserManager.startUpdateAdvertisingAndListening(withPort: 42,
                                                             errorHandler: unexpectedErrorHandler)
        XCTAssertEqual(advertiserManager.advertisers.value.count, 1)
        XCTAssertTrue(advertiserManager.advertising)
        advertiserManager.stopAdvertising()
        XCTAssertEqual(advertiserManager.advertisers.value.count, 0)
        XCTAssertFalse(advertiserManager.advertising)
    }

    func testHasAdvertiserWithIdentifier() {
        advertiserManager.startUpdateAdvertisingAndListening(withPort: 42,
                                                             errorHandler: unexpectedErrorHandler)
        let currentAdvertiserIdentifier = (advertiserManager.currentAdvertiser?.peerIdentifier)!
        XCTAssertTrue(advertiserManager.hasAdvertiser(with: currentAdvertiserIdentifier))
    }

    func testHasAdvertiserWithIdentifierReturnsFalse() {
        let notAdvertisingIdentifier = PeerIdentifier()
        XCTAssertFalse(advertiserManager.hasAdvertiser(with: notAdvertisingIdentifier))
    }

    func testStartAdvertisingIncrementAdvertiserIdentifiers() {
        XCTAssertEqual(advertiserManager.advertiserIdentifiers.count, 0)
        advertiserManager.startUpdateAdvertisingAndListening(withPort: 42,
                                                             errorHandler: unexpectedErrorHandler)
        XCTAssertEqual(advertiserManager.advertiserIdentifiers.count, 1)
    }
}
