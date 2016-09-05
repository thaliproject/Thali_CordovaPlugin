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

    var advertiserManager: AdvertiserManager!

    override func setUp() {
        let serviceType = String.random(length: 7)
        advertiserManager = AdvertiserManager(serviceType: serviceType, disposeAdvertiserTimeout: 1.0)
    }

    override func tearDown() {
        advertiserManager.stopAdvertising()
        advertiserManager = nil
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
