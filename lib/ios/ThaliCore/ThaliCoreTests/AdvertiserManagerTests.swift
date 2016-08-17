//
//  Thali CordovaPlugin
//  AdvertiserManagerTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import XCTest
@testable import ThaliCore

class AdvertiserManagerTests: XCTestCase {

    var advertiserManager: AdvertiserManager!

    override func setUp() {
        let serviceType = String.randomStringWithLength(7)
        advertiserManager = AdvertiserManager(serviceType: serviceType)
    }

    override func tearDown() {
        advertiserManager.stopAdvertisingAndListening()
        advertiserManager = nil
    }

    func testStopAdvertising() {
        advertiserManager.startUpdateAdvertisingAndListening(42)
        XCTAssertEqual(advertiserManager.advertisers.count, 1)
        XCTAssertTrue(advertiserManager.isAdvertising)
        advertiserManager.stopAdvertisingAndListening()
        XCTAssertEqual(advertiserManager.advertisers.count, 0)
        XCTAssertFalse(advertiserManager.isAdvertising)
    }
}
