//
//  Thali CordovaPlugin
//  BrowserManagerTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import XCTest
@testable import ThaliCore

class BrowserManagerTests: XCTestCase {
    var browser: BrowserManager!

    override func setUp() {
        let serviceType = String.randomStringWithLength(7)
        browser = BrowserManager(serviceType: serviceType)
    }

    override func tearDown() {
        browser = nil
    }

    func testStopBrowsing() {
        browser.startListeningForAdvertisements()
        XCTAssertNotNil(browser.currentBrowser)
        XCTAssertTrue(browser.isListening)
        browser.stopListeningForAdvertisements()
        XCTAssertNil(browser.currentBrowser)
        XCTAssertFalse(browser.isListening)
    }
}
