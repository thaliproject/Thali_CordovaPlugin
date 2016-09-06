//
//  Thali CordovaPlugin
//  SocketRelayTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license
//  information.
//

import XCTest
@testable import ThaliCore
import MultipeerConnectivity

class SocketRelayTests: XCTestCase {

    func testSocketCreateTimeout() {
        let timeout: Double = 1.0
        let relay = SocketRelay<BrowserVirtualSocketBuilder>(createSocketTimeout: timeout)
        let peerID = MCPeerID(displayName: "test")
        let mcSession = MCSession(peer: peerID)
        let session = Session(session: mcSession, identifier: peerID) { _ in }
        let expectation = expectationWithDescription("got connection timed out")
        var error: ThaliCoreError?
        relay.createSocket(with: session) { port, err in
            error = err as? ThaliCoreError
            expectation.fulfill()
        }
        waitForExpectationsWithTimeout(timeout + 1, handler: nil)
        XCTAssertEqual(error, .ConnectionTimedOut)
    }

    func testCreateSocket() {
        let foundPeerExpectation = expectationWithDescription("found peer")
        let peerIdentifier = PeerIdentifier()
        var browserStreams, advertiserStreams: (NSOutputStream, NSInputStream)?

        let (advertiser, browser) = createMCPFConnection(advertiserIdentifier: peerIdentifier,
                                                         advertiserSessionHandler: { session in
            let _ = AdvertiserVirtualSocketBuilder(session: session,
                completionHandler: { socket, error in
                advertiserStreams = socket
            })
        }) { [weak foundPeerExpectation] in
            foundPeerExpectation?.fulfill()
        }
        waitForExpectationsWithTimeout(5, handler: nil)

        do {
            let session = try browser.inviteToConnectPeer(with: peerIdentifier,
                    disconnectHandler: {})
            let socketCreatedExpectation = expectationWithDescription("socket created")
            let _ = BrowserVirtualSocketBuilder(session: session,
                    completionHandler: { [weak socketCreatedExpectation] socket, error in
                        browserStreams = socket
                        socketCreatedExpectation?.fulfill()
                    })
            waitForExpectationsWithTimeout(10, handler: nil)

            XCTAssertNotNil(advertiser)
            XCTAssertNotNil(browserStreams)
            XCTAssertNotNil(advertiserStreams)
        } catch let error {
            XCTAssertNil(error)
        }
    }
}
