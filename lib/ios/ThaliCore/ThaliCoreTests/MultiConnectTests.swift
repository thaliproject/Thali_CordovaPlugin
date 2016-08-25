//
//  Thali CordovaPlugin
//  MultiConnectTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import XCTest
import MultipeerConnectivity
@testable import ThaliCore

class MultiConnectTests: XCTestCase {

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
            let _ = AdvertiserVirtualSocketBuilder(session: session, didCreateSocketHandler: { socket in
                advertiserStreams = socket
            }) { _ in}
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
            let _ = BrowserVirtualSocketBuilder(session: session,
                                                didCreateSocketHandler: { [weak socketCreatedExpectation] socket in
                                                    browserStreams = socket
                                                    socketCreatedExpectation?.fulfill()
            }) { _ in }
            waitForExpectationsWithTimeout(30, handler: nil)

            XCTAssertNotNil(browserStreams)
            XCTAssertNotNil(advertiserStreams)
        } catch let error {
            XCTAssertNil(error)
        }
    }

    func testLostConnection() {
        XCTAssert(false, "not implemented")
    }

    func testDisconnect() {
        XCTAssert(false, "not implemented")
    }

    func test5secTimeout() {
        let relay = SocketRelay<BrowserVirtualSocketBuilder>()
        let peerID = MCPeerID(displayName: "test")
        let mcSession = MCSession(peer: peerID)
        let session = Session(session: mcSession, identifier: peerID)
        let timeout: Double = 3.0
        let expectation = expectationWithDescription("got connection timed out")
        var error: MultiСonnectError?
        relay.createSocket(with: session, timeout: timeout) { port, err in
            error = err as? MultiСonnectError
            expectation.fulfill()
        }
        waitForExpectationsWithTimeout(timeout + 1, handler: nil)
        XCTAssertEqual(error, .ConnectionTimedOut)
    }
}
