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
    var errorOnCreateStream = false
    override func startStreamWithName(streamName: String,
                                      toPeer peerID: MCPeerID) throws -> NSOutputStream {
        guard !errorOnCreateStream else {
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

    func testSessionDisconnected() {
        let disconnectedExpectation = expectationWithDescription("disconnected")
        let session = Session(session: mcSession, identifier: peerID) {
            [weak disconnectedExpectation] in
            disconnectedExpectation?.fulfill()
        }
        mcSession.delegate?.session(mcSession, peer: peerID, didChangeState: .NotConnected)
        waitForExpectationsWithTimeout(2, handler: nil)
    }

    func testCreateOutputStreramAfterConnected() {
        let createdStreamExpectation = expectationWithDescription("stream created")
        let session = Session(session: mcSession, identifier: peerID) {}
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

    func testCreateOutputStreramBeforeConnected() {
        let session = Session(session: mcSession, identifier: peerID) {}
        let outputStreamsCount = 3

        let createdStreamsExpectation = expectationWithDescription("streams created")
        var outputStreams: [NSOutputStream] = []
        for i in 0...outputStreamsCount {
            session.createOutputStream(withName: "test\(i)") {
                [weak createdStreamsExpectation] outputStream, error in
                guard let stream = outputStream else {
                    return
                }
                outputStreams.append(stream)
                if outputStreams.count == outputStreamsCount {
                    createdStreamsExpectation?.fulfill()
                }
            }
        }
        mcSession.delegate?.session(mcSession, peer: peerID, didChangeState: .Connected)
        waitForExpectationsWithTimeout(1.0, handler: nil)
    }

    func testCreateStreamError() {
        mcSession.errorOnCreateStream = true
        let session = Session(session: mcSession, identifier: peerID) {}
        let gotErrorExpectation = expectationWithDescription("get error on create stream")
        var err: ErrorType?
        mcSession.delegate?.session(mcSession, peer: peerID, didChangeState: .Connected)
        session.createOutputStream(withName: "test") { [weak gotErrorExpectation] stream, error in
            err = error
            gotErrorExpectation?.fulfill()
        }
        waitForExpectationsWithTimeout(1.0, handler: nil)
        XCTAssertNotNil(err)
    }

    func testReceiveInputStream() {
        let streamName = "name"
        let session = Session(session: mcSession, identifier: peerID) {}

        let getStreamExpectation = expectationWithDescription("received input stream")

        var receivedStreamName: String?
        session.getInputStream { [weak getStreamExpectation] stream, name in
            receivedStreamName = name
            getStreamExpectation?.fulfill()
        }
        mcSession.delegate?.session(mcSession, didReceiveStream:
            NSInputStream(data: NSData(bytes: nil, length: 0)),
                                    withName: streamName, fromPeer: peerID)
        waitForExpectationsWithTimeout(1.0, handler: nil)
        XCTAssertEqual(streamName, receivedStreamName)
    }
}
