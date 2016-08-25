//
//  Thali CordovaPlugin
//  AdvertiserSessionManagerTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import XCTest
@testable import ThaliCore

class AdvertiserSessionManagerTests: XCTestCase {

    func testCreateSocket() {
        let serviceType = String.random(length: 7)
        var peerIdentifier: PeerIdentifier? = nil
        var browserStreams, advertiserStreams: (NSOutputStream, NSInputStream)?

        let foundPeerExpectation = expectationWithDescription("found peer")
        let browser = Browser(serviceType: serviceType, foundPeer: { [weak foundPeerExpectation] identifier in
                peerIdentifier = identifier
                foundPeerExpectation?.fulfill()
            }, lostPeer: { _ in })
        browser.startListening()
        let advertiser = Advertiser(peerIdentifier: PeerIdentifier(), serviceType: serviceType, port: 0) { (session) in
            let _ = AdvertiserSessionManager(session: session, didCreateSocketHandler: { socket in
                advertiserStreams = socket
            })
        }
        advertiser.startAdvertising()

        waitForExpectationsWithTimeout(10, handler: nil)
        XCTAssertNotNil(peerIdentifier)

        guard let identifier = peerIdentifier else {
            XCTAssert(false, "peer identifier not found")
            return
        }
        do {
            let session = try browser.invitePeerToConnect(identifier)
            let socketCreatedExpectation = expectationWithDescription("socket created")
            let _ = BrowserSessionManager(session: session) { [weak socketCreatedExpectation] socket in
                browserStreams = socket
                socketCreatedExpectation?.fulfill()
            }
            waitForExpectationsWithTimeout(30, handler: nil)

            XCTAssertNotNil(browserStreams)
            XCTAssertNotNil(advertiserStreams)

        } catch let error {
            XCTAssertNil(error)
        }
    }
}
