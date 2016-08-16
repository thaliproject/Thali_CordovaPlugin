//
//  Thali CordovaPlugin
//  PeerDiscoveryTests.swift
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
        let serviceType = String.randomStringWithLength(7)
        browser = BrowserManager(serviceType: serviceType)
        advertiser = AdvertiserManager(serviceType: serviceType)
    }

    override func tearDown() {
        advertiser.stopAdvertisingAndListening()
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
        advertiser.startUpdateAdvertisingAndListening(42)
        let advertiserIdentifier = advertiser.currentAdvertiser?.peerIdentifier

        waitForExpectationsWithTimeout(10, handler: nil)

        XCTAssertTrue(advertiserPeerAvailability?.available ?? false)
        XCTAssertEqual(advertiserIdentifier, advertiserPeerAvailability?.peerIdentifier)
    }

    func testDisposeAdvertiserAfter30sec() {
        advertiser.startUpdateAdvertisingAndListening(42)
        XCTAssertEqual(advertiser.advertisers.count, 1)
        let firstAdvertiserIdentifier = advertiser.currentAdvertiser?.peerIdentifier

        advertiser.startUpdateAdvertisingAndListening(4242)
        XCTAssertEqual(advertiser.advertisers.count, 2)
        let expectation = expectationWithDescription("advertiser removed after delay")
        advertiser.didRemoveAdvertiserWithIdentifierHandler = { [weak expectation] identifier in
            XCTAssertEqual(firstAdvertiserIdentifier, identifier)
            expectation?.fulfill()
        }

        waitForExpectationsWithTimeout(40, handler: nil)
        XCTAssertEqual(advertiser.advertisers.count, 1)
    }

    func testStopBrowsing() {
        browser.startListeningForAdvertisements()
        XCTAssertNotNil(browser.currentBrowser)
        browser.stopListeningForAdvertisements()
        XCTAssertNil(browser.currentBrowser)
    }

    func testLostPeer() {
        let lostPeerExpectation = expectationWithDescription("lost peer advertiser's identifier")
        var advertiserPeerAvailability: PeerAvailability? = nil
        browser.peersAvailabilityChanged = { peerAvailability in
            if let availability = peerAvailability.first where availability.available == false {
                advertiserPeerAvailability = availability
                lostPeerExpectation.fulfill()
            }
        }

        browser.startListeningForAdvertisements()
        advertiser.startUpdateAdvertisingAndListening(42)
        let advertiserIdentifier = advertiser.currentAdvertiser?.peerIdentifier

        let delayTime = dispatch_time(DISPATCH_TIME_NOW, Int64(2 * Double(NSEC_PER_SEC)))
        dispatch_after(delayTime, dispatch_get_main_queue()) {
            self.advertiser.stopAdvertisingAndListening()
        }

        waitForExpectationsWithTimeout(20, handler: nil)
        XCTAssertEqual(advertiserIdentifier, advertiserPeerAvailability?.peerIdentifier)
    }

}
