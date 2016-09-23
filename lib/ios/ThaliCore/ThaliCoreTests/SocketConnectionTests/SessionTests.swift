//
//  Thali CordovaPlugin
//  SessionTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import XCTest
import Foundation
@testable import ThaliCore
import MultipeerConnectivity

class MCSessionMock: MCSession {

    var errorOnStartStream = false
    override func startStreamWithName(streamName: String,
                                      toPeer peerID: MCPeerID) throws -> NSOutputStream {
        guard !errorOnStartStream else {
            throw NSError(domain: "org.thaliproject.test", code: 42, userInfo: nil)
        }
        return NSOutputStream(toBuffer: nil, capacity: 0)
    }
}

class SessionTests: XCTestCase {

    var disconnectedExpectation: XCTestExpectation!
    var mcSession: MCSessionMock!
    var peerID: MCPeerID!

    override func setUp() {
        mcSession = MCSessionMock(peer: MCPeerID(displayName: String.random(length: 5)))
        peerID = MCPeerID(displayName: String.random(length: 5))
    }

    func testReceiveDisconnectedNotificationAfterMCSessionDelegateCall() {
        // Precondition
        let disconnectedExpectation =
            expectationWithDescription("session disconnected notification received")
        let session = Session(session: mcSession, identifier: peerID) {
            [weak disconnectedExpectation] in
            disconnectedExpectation?.fulfill()
        }

        mcSession.delegate?.session(mcSession, peer: peerID, didChangeState: .NotConnected)

        // Should
        let sessionDisconnectedExpectationTimeout: NSTimeInterval = 2
        waitForExpectationsWithTimeout(sessionDisconnectedExpectationTimeout, handler: nil)
        XCTAssertEqual(session.sessionState.value, MCSessionState.NotConnected)
    }

    func testReceiveInputStream() {
        // Preconditions
        let streamName = NSUUID().UUIDString
        let session = Session(session: mcSession, identifier: peerID,
                              disconnectHandler: unexpectedDisconnectHandler)
        let receivedStreamExpectation = expectationWithDescription("received input stream")
        var receivedStreamName: String?

        session.didReceiveInputStreamHandler = { [weak receivedStreamExpectation] stream, name in
            receivedStreamName = name
            receivedStreamExpectation?.fulfill()
        }
        mcSession.delegate?.session(mcSession, didReceiveStream:
            NSInputStream(data: NSData(bytes: nil, length: 0)),
                                    withName: streamName, fromPeer: peerID)

        // Should
        let receivedStreamTimeout = 1.0
        waitForExpectationsWithTimeout(receivedStreamTimeout, handler: nil)
        XCTAssertEqual(streamName, receivedStreamName)
    }

}
