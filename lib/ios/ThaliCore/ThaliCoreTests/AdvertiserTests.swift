//
//  Thali CordovaPlugin
//  AdvertiserTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import XCTest
@testable import ThaliCore

class AdvertiserTests: XCTestCase {
    var browser: BrowserManager!
    var advertiser: AdvertiserManager!
    
    override func setUp() {
        let string = NSUUID().UUIDString
        let serviceType = string[string.startIndex...string.startIndex.advancedBy(6)]
        browser = BrowserManager(serviceType: serviceType)
        advertiser = AdvertiserManager(serviceType: serviceType)
    }
    
    override func tearDown() {
        advertiser.stopAdvertisingAndListening()
        NSThread.sleepForTimeInterval(1.0)
        browser = nil
        advertiser = nil
    }
    
    func testFoundAdvertiser() {        
        let expectation = expectationWithDescription("found peer advertiser's identifier")
        var advertiserPeerAvailability: PeerAvailability? = nil
        browser.peersAvailabilityChanged = { [weak expectation] peerAvailability in
            advertiserPeerAvailability = peerAvailability.first
            expectation?.fulfill()
        }
        
        browser.startListeningForAdvertisements()
        advertiser.startAdvertisingAndListening(42)
        let advertiserIdentifier = advertiser.currentAdvertiser?.peerIdentifier
        
        waitForExpectationsWithTimeout(10, handler: nil)
        
        XCTAssertTrue(advertiserPeerAvailability?.available ?? false)
        XCTAssertEqual(advertiserIdentifier, advertiserPeerAvailability?.peerIdentifier)
    }
    
    func testDisposeAdvertiserAfter30sec() {
        advertiser.startAdvertisingAndListening(42)
        XCTAssertEqual(advertiser.advertisers.count, 1)
        let firstAdvertiserIdentifier = advertiser.currentAdvertiser?.peerIdentifier

        advertiser.startAdvertisingAndListening(4242)
        XCTAssertEqual(advertiser.advertisers.count, 2)
        let expectation = expectationWithDescription("advertiser removed after delay")
        advertiser.didRemoveAdvertiserWithIdentifierHandler = { [weak expectation] identifier in
            XCTAssertEqual(firstAdvertiserIdentifier, identifier)
            expectation?.fulfill()
        }

        waitForExpectationsWithTimeout(31, handler: nil)
        XCTAssertEqual(advertiser.advertisers.count, 1)
    }
    
    func testStopAdvertising() {
        advertiser.startAdvertisingAndListening(42)
        XCTAssertEqual(advertiser.advertisers.count, 1)
        advertiser.stopAdvertisingAndListening()
        XCTAssertEqual(advertiser.advertisers.count, 0)
    }
    
    func testStopBrowsing() {
        browser.startListeningForAdvertisements()
        XCTAssertNotNil(browser.currentBrowser)
        browser.stopListeningForAdvertisements()
        XCTAssertNil(browser.currentBrowser)
    }

}
