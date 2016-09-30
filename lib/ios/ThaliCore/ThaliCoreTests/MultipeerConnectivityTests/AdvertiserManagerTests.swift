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
                                              disposeAdvertiserTimeout: disposeTimeout)
    }

    override func tearDown() {
        advertiserManager.stopAdvertising()
        advertiserManager = nil
    }

    func testStartAdvertisingChangesState() {
        // Given
        XCTAssertFalse(advertiserManager.advertising)

        // When
        advertiserManager.startUpdateAdvertisingAndListening(onPort: 42,
                                                             errorHandler: unexpectedErrorHandler)

        // Then
        XCTAssertTrue(advertiserManager.advertising)
    }

    func testStartStopAdvertisingChangesInternalAmountOfAdvertisers() {
        // Given
        let expectedAmountOfAdvertisersBeforeStartMethod = 0
        let expectedAmountOfAdvertisersAfterStartMethod = 1
        let expectedAmountOfAdvertisersAfterStopMethod = 0

        XCTAssertEqual(advertiserManager.advertisers.value.count,
                       expectedAmountOfAdvertisersBeforeStartMethod)

        // When
        advertiserManager.startUpdateAdvertisingAndListening(onPort: 42,
                                                             errorHandler: unexpectedErrorHandler)

        // Then
        XCTAssertTrue(advertiserManager.advertising, "advertising is not active")
        XCTAssertEqual(advertiserManager.advertisers.value.count,
                       expectedAmountOfAdvertisersAfterStartMethod)

        // When
        advertiserManager.stopAdvertising()

        // Then
        XCTAssertFalse(advertiserManager.advertising, "advertising is still active")
        XCTAssertEqual(advertiserManager.advertisers.value.count,
                       expectedAmountOfAdvertisersAfterStopMethod)
    }

    func testAdvertiserDisposedAfterTimeoutWhenSecondAdvertiserStarts() {
        // Given
        let port1: UInt16 = 42
        let port2: UInt16 = 43

        advertiserManager.startUpdateAdvertisingAndListening(onPort: port1,
                                                             errorHandler: unexpectedErrorHandler)
        XCTAssertEqual(advertiserManager.advertisers.value.count, 1)

        let firstAdvertiserPeerIdentifier =
            advertiserManager.advertisers.value.first!.peerIdentifier
        let firstAdvertiserDisposedExpectation =
            expectationWithDescription("advertiser disposed after delay")

        // When
        advertiserManager.startUpdateAdvertisingAndListening(onPort: port2,
                                                             errorHandler: unexpectedErrorHandler)
        XCTAssertEqual(advertiserManager.advertisers.value.count, 2)

        advertiserManager.didRemoveAdvertiserWithIdentifierHandler = {
            [weak firstAdvertiserDisposedExpectation] identifier in

            XCTAssertEqual(firstAdvertiserPeerIdentifier, identifier)
            firstAdvertiserDisposedExpectation?.fulfill()
        }

        // Then
        waitForExpectationsWithTimeout(disposeTimeout, handler: nil)
        XCTAssertEqual(advertiserManager.advertisers.value.count, 1)
    }
}
