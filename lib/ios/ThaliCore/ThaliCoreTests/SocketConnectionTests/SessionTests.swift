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

    // MARK: - Public state
    var errorOnStartStream = false

    // MARK: - Overrided methods
    override func startStreamWithName(streamName: String,
                                      toPeer peerID: MCPeerID) throws -> NSOutputStream {

        guard !errorOnStartStream else {
            throw NSError(domain: "org.thaliproject.test", code: 42, userInfo: nil)
        }

        return NSOutputStream(toBuffer: nil, capacity: 0)
    }
}

class SessionTests: XCTestCase {

    var peerID: MCPeerID!
    var mcSession: MCSessionMock!
    var disconnectedExpectation: XCTestExpectation!

    override func setUp() {
        mcSession = MCSessionMock(peer: MCPeerID(displayName: String.random(length: 5)))
        peerID = MCPeerID(displayName: String.random(length: 5))
    }

    func testConnectedHandlerAfterMCSessionDelegateCall() {
        // Given
        let connectHandlerInvokedExpectation =
            expectationWithDescription("session connected handler invoked")

        let session = Session(session: mcSession,
                              identifier: peerID,
                              connectHandler: {
                                  [weak connectHandlerInvokedExpectation] in
                                  connectHandlerInvokedExpectation?.fulfill()
                              },
                              disconnectHandler: unexpectedDisconnectHandler)

        // When
        // Fake delegate method invocation
        mcSession.delegate?.session(mcSession, peer: peerID, didChangeState: .Connected)

        // Then
        let connectHandlerExpectationTimeout: NSTimeInterval = 2
        waitForExpectationsWithTimeout(connectHandlerExpectationTimeout, handler: nil)
        XCTAssertEqual(session.sessionState.value, MCSessionState.Connected)
    }

    func testDisconnectedHandlerAfterMCSessionDelegateCall() {
        // Given
        let disconnectHandlerInvokedExpectation =
            expectationWithDescription("session disconnected handler invoked")

        let session = Session(session: mcSession,
                              identifier: peerID,
                              connectHandler: unexpectedConnectHandler,
                              disconnectHandler: {
                                  [weak disconnectHandlerInvokedExpectation] in
                                  disconnectHandlerInvokedExpectation?.fulfill()
                              })

        // When
        // Fake delegate method invocation
        mcSession.delegate?.session(mcSession, peer: peerID, didChangeState: .NotConnected)

        // Then
        let disconnectHandlerExpectationTimeout: NSTimeInterval = 2
        waitForExpectationsWithTimeout(disconnectHandlerExpectationTimeout, handler: nil)
        XCTAssertEqual(session.sessionState.value, MCSessionState.NotConnected)
    }

    func testInputStreamHandler() {
        // Given
        let session = Session(session: mcSession,
                              identifier: peerID,
                              connectHandler:  unexpectedConnectHandler,
                              disconnectHandler: unexpectedDisconnectHandler)
        var receivedStreamName: String?

        let receivedStreamExpectation = expectationWithDescription("received input stream")

        session.didReceiveInputStreamHandler = {
            [weak receivedStreamExpectation] stream, name in

            receivedStreamName = name
            receivedStreamExpectation?.fulfill()
        }

        let emptyData = NSData(bytes: nil, length: 0)
        let randomlyGeneratedStreamName = NSUUID().UUIDString

        // When
        // Fake delegate method invocation
        mcSession.delegate?.session(mcSession,
                                    didReceiveStream: NSInputStream(data: emptyData),
                                    withName: randomlyGeneratedStreamName,
                                    fromPeer: peerID)

        // Then
        let receivedStreamTimeout = 1.0
        waitForExpectationsWithTimeout(receivedStreamTimeout, handler: nil)
        XCTAssertEqual(randomlyGeneratedStreamName, receivedStreamName)
    }
}
