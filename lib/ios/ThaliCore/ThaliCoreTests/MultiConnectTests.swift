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

    private func createMCPFConnection(advertiserIdentifier: PeerIdentifier, advertiserSessionHandler: (Session) -> Void,
                                      completion: () -> Void) -> (Advertiser, Browser) {
        let serviceType = String.random(length: 7)

        let browser = Browser(serviceType: serviceType, foundPeer: { identifier in
            completion()
            }, lostPeer: { _ in })
        browser.startListening()
        let advertiser = Advertiser(peerIdentifier: advertiserIdentifier,
                                    serviceType: serviceType, receivedInvitationHandler: advertiserSessionHandler)
        advertiser.startAdvertising()

        return (advertiser, browser)
    }

    func testCreateSocket() {
        let foundPeerExpectation = expectationWithDescription("found peer")
        let peerIdentifier = PeerIdentifier()
        var browserStreams, advertiserStreams: (NSOutputStream, NSInputStream)?

        let (advertiser, browser) = createMCPFConnection(peerIdentifier, advertiserSessionHandler: { session in
            let _ = AdvertiserVirtualSocketBuilder(session: session, completionHandler: { socket, error in
                advertiserStreams = socket
                }, disconnectedHandler: {
            })
        }) { [weak foundPeerExpectation] in
            foundPeerExpectation?.fulfill()
        }
        waitForExpectationsWithTimeout(5, handler: nil)

        do {
            let session = try browser.invitePeerToConnect(peerIdentifier)
            let socketCreatedExpectation = expectationWithDescription("socket created")
            let _ = BrowserVirtualSocketBuilder(session: session,
                                                completionHandler: { [weak socketCreatedExpectation] socket, error in
                                                    browserStreams = socket
                                                    socketCreatedExpectation?.fulfill()
            }) { _ in }
            waitForExpectationsWithTimeout(10, handler: nil)

            XCTAssertNotNil(advertiser)
            XCTAssertNotNil(browserStreams)
            XCTAssertNotNil(advertiserStreams)
        } catch let error {
            XCTAssertNil(error)
        }
    }

    func testSessionDisconnected() {
        let disconnectedExpectation = expectationWithDescription("found peer")
        let mcSession = MCSession(peer: MCPeerID(displayName: String.random(length: 5)))
        let peerID = MCPeerID(displayName: String.random(length: 5))
        let session = Session(session: mcSession, identifier: peerID)
        let _ = VirtualSocketBuilder(session: session, completionHandler: { data in },
                                     disconnectedHandler: { [weak disconnectedExpectation] in
            disconnectedExpectation?.fulfill()
        })
        //dirty hack to check flow
        mcSession.delegate?.session(mcSession, peer: peerID, didChangeState: .NotConnected)
        waitForExpectationsWithTimeout(2, handler: nil)
    }

    func testSocketCreateTimeout() {
        let relay = SocketRelay<BrowserVirtualSocketBuilder>()
        let peerID = MCPeerID(displayName: "test")
        let mcSession = MCSession(peer: peerID)
        let session = Session(session: mcSession, identifier: peerID)
        let timeout: Double = 3.0
        let expectation = expectationWithDescription("got connection timed out")
        var error: MultiConnectError?
        relay.createSocket(with: session, timeout: timeout) { port, err in
            error = err as? MultiConnectError
            expectation.fulfill()
        }
        waitForExpectationsWithTimeout(timeout + 1, handler: nil)
        XCTAssertEqual(error, .ConnectionTimedOut)
    }
}
