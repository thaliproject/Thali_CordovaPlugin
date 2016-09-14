//
//  Thali CordovaPlugin
//  SocketRelayTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import XCTest
@testable import ThaliCore
import MultipeerConnectivity

class VirtualSocketBuilderMock: VirtualSocketBuilder {

    required init(session: Session,
                  completionHandler: ((NSOutputStream, NSInputStream)?, ErrorType?) -> Void) {
        super.init(session: session, completionHandler: completionHandler)
        let inputStream = NSInputStream(data: NSData(bytes: nil, length: 0))
        let outputStream = NSOutputStream(toBuffer: nil, capacity: 0)
        completionHandler((outputStream, inputStream), nil)
    }
}

class SocketRelayTests: XCTestCase {

    func testGetTimeoutErrorOnCreateSocket() {
        // Preconditions
        let createSocketTimeout: Double = 1.0
        let relay =
            SocketRelay<BrowserVirtualSocketBuilder>(createSocketTimeout: createSocketTimeout)
        let peerID = MCPeerID(displayName: NSUUID().UUIDString)
        let mcSession = MCSession(peer: peerID)
        let session = Session(session: mcSession, identifier: peerID,
                              disconnectHandler: unexpectedDisconnectHandler)
        var error: MultiConnectError?
        let getTimeoutErrorOnCreateSocketExpectation =
            expectationWithDescription("get timeout error on create socket")

        relay.createSocket(with: session) { port, err in
            error = err as? MultiConnectError
            getTimeoutErrorOnCreateSocketExpectation.fulfill()
        }

        // Should
        waitForExpectationsWithTimeout(createSocketTimeout, handler: nil)
        XCTAssertEqual(error, .ConnectionTimedOut)
    }

    func testReceiveVirtualSocketOnCreateSocket() {
        // Preconditions
        let foundPeerExpectation = expectationWithDescription("found peer")
        let peerIdentifier = PeerIdentifier()
        var browserStreams, advertiserStreams: (NSOutputStream, NSInputStream)?

        let (advertiser, browser) = createMPCFConnection(advertiserIdentifier: peerIdentifier,
                                                         advertiserSessionHandler: { session in
            let _ = AdvertiserVirtualSocketBuilder(session: session,
                completionHandler: { socket, error in
                advertiserStreams = socket
            })
        }) { [weak foundPeerExpectation] in
            foundPeerExpectation?.fulfill()
        }
        let foundPeerTimeout: Double = 2.0
        waitForExpectationsWithTimeout(foundPeerTimeout, handler: nil)

        do {
            let session = try browser.inviteToConnectPeer(with: peerIdentifier,
                    disconnectHandler: unexpectedDisconnectHandler)
            let socketCreatedExpectation = expectationWithDescription("socket created")
            let _ = BrowserVirtualSocketBuilder(session: session,
                    completionHandler: { [weak socketCreatedExpectation] socket, error in
                        browserStreams = socket
                        socketCreatedExpectation?.fulfill()
                    })
            let socketCreatedTimeout: Double = 5
            waitForExpectationsWithTimeout(socketCreatedTimeout, handler: nil)

            // Should
            XCTAssertNotNil(advertiser)
            XCTAssertNotNil(browserStreams)
            XCTAssertNotNil(advertiserStreams)
        } catch let error {
            XCTAssertNil(error)
        }
    }

    func testCloseSocket() {
        let socketCreatedExpectation = expectationWithDescription("socket created expectation")
        let socketRelay = SocketRelay<VirtualSocketBuilderMock>(createSocketTimeout: 10)
        let session = SessionMock(session: MCSession(peer: MCPeerID(displayName:"peer1")),
                                  identifier: MCPeerID(displayName:"peer2")) { }
        socketRelay.createSocket(with: session) { [weak socketCreatedExpectation] port, error in
            socketCreatedExpectation?.fulfill()
        }

        let createSocketTimeout = 1.0
        waitForExpectationsWithTimeout(createSocketTimeout, handler: nil)

        XCTAssertEqual(socketRelay.activeSessions.value.count, 1)
        socketRelay.closeSocket(for: session)
        XCTAssertEqual(socketRelay.activeSessions.value.count, 0)
    }
}
