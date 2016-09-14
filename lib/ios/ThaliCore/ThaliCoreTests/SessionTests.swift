//
//  Thali CordovaPlugin
//  SessionTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license
//  information.
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
        let sessionDisconnectedExpectationTimeout: Double = 2
        waitForExpectationsWithTimeout(sessionDisconnectedExpectationTimeout, handler: nil)
        XCTAssertEqual(session.sessionState.value, MCSessionState.NotConnected)
    }

    func testCreateOutputStreamAfterSessionReceivedConnectedState() {
        let createdStreamExpectation = expectationWithDescription("stream created")
        let session = Session(session: mcSession, identifier: peerID,
                              disconnectHandler: unexpectedDisconnectHandler)
        var stream: NSOutputStream? = nil

        mcSession.delegate?.session(mcSession, peer: peerID, didChangeState: .Connected)

        session.createOutputStream(withName: "test") {
            [weak createdStreamExpectation] outputStream, error in
            stream = outputStream
            createdStreamExpectation?.fulfill()
        }

        waitForExpectationsWithTimeout(1.0, handler: nil)
        XCTAssertNotNil(stream)
    }

    func testCreateOutputStreamBeforeSessionReceivedConnectedState() {
        // Preconditions
        let session = Session(session: mcSession, identifier: peerID,
                              disconnectHandler: unexpectedDisconnectHandler)
        let expectedStreamsCount = 3
        let allStreamsWereCreatedExpectation = expectationWithDescription("streams created")
        var alreadyCreatedStreams: [NSOutputStream] = []

        for i in 0...expectedStreamsCount {
            session.createOutputStream(withName: "test\(i)") {
                [weak allStreamsWereCreatedExpectation] outputStream, error in
                guard let stream = outputStream else {
                    return
                }
                alreadyCreatedStreams.append(stream)
                if alreadyCreatedStreams.count == expectedStreamsCount {
                    allStreamsWereCreatedExpectation?.fulfill()
                }
            }
        }
        mcSession.delegate?.session(mcSession, peer: peerID, didChangeState: .Connected)

        // Should
        let allStreamsWereCreatedTimeout = 1.0
        waitForExpectationsWithTimeout(allStreamsWereCreatedTimeout, handler: nil)
    }

    func testCreateStreamError() {
        // Preconditions
        mcSession.errorOnStartStream = true
        let session = Session(session: mcSession, identifier: peerID,
                              disconnectHandler: unexpectedDisconnectHandler)
        let errorOnCreateStreamExpectation =
            expectationWithDescription("get error on create stream")
        var err: ErrorType?

        mcSession.delegate?.session(mcSession, peer: peerID, didChangeState: .Connected)
        session.createOutputStream(withName: "test") {
            [weak errorOnCreateStreamExpectation] stream, error in
            err = error
            errorOnCreateStreamExpectation?.fulfill()
        }

        // Should
        let errorOnCreateStreamTimeout = 1.0
        waitForExpectationsWithTimeout(errorOnCreateStreamTimeout, handler: nil)
        XCTAssertNotNil(err)
    }

    func testReceiveInputStream() {
        // Preconditions
        let streamName = NSUUID().UUIDString
        let session = Session(session: mcSession, identifier: peerID,
                              disconnectHandler: unexpectedDisconnectHandler)
        let receivedStreamExpectation = expectationWithDescription("received input stream")
        var receivedStreamName: String?

        session.getInputStream { [weak receivedStreamExpectation] stream, name in
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

    // Smoke test
    func testDisconnect() {
        let peerID = MCPeerID(displayName: PeerIdentifier().stringValue)
        let mcSession = MCSessionMock(peer: peerID, securityIdentity: nil,
                                      encryptionPreference: .None)
        let session = Session(session: mcSession,
                              identifier: peerID,
                              disconnectHandler: unexpectedDisconnectHandler)
        session.disconnect()
    }
}
