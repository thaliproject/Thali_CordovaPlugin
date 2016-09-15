//
//  Thali CordovaPlugin
//  VirtualSocketBuilderTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import XCTest
@testable import ThaliCore
import MultipeerConnectivity

class SessionMock: Session {

    var simulateRelay: Bool = true
    private var outputStreamName: String?

    func getInputStreamName() -> String {
        guard let streamName = outputStreamName where simulateRelay else {
            return ""
        }
        return streamName
    }

    override func getInputStream(completion: (NSInputStream, String) -> Void) {
        completion(NSInputStream(data: NSData(bytes: nil, length: 0)), getInputStreamName())
    }

    override func createOutputStream(withName name: String,
                                     completion: (NSOutputStream?, ErrorType?) -> Void) {
        outputStreamName = name
        completion(NSOutputStream(toBuffer: nil, capacity: 0), nil)
    }
}

class VirtualSocketBuilderTests: XCTestCase {

    var socketCreatedExpectation: XCTestExpectation!
    var session: SessionMock!

    override func setUp() {
        super.setUp()
        socketCreatedExpectation = expectationWithDescription("Socket created")
        session = SessionMock(session: MCSession(peer: MCPeerID(displayName:"peer1")),
                              identifier: MCPeerID(displayName:"peer2")) {
        }
    }

    private func createSocket<Builder: VirtualSocketBuilder>(session: Session,
                              completion: ((NSOutputStream, NSInputStream)?, ErrorType?) -> Void)
                                                                                        -> Builder {
        return Builder(session: session, completionHandler: completion)
    }

    func testSocketCreatedWithAdvertiserBuilder() {
        var socket: (NSOutputStream, NSInputStream)?

        let _: AdvertiserVirtualSocketBuilder = createSocket(session) {
            [weak socketCreatedExpectation] receivedSocket, error in
            socket = receivedSocket
            socketCreatedExpectation?.fulfill()
        }

        let socketCreatedTimeout = 2.0
        waitForExpectationsWithTimeout(socketCreatedTimeout, handler: nil)
        XCTAssertNotNil(socket)
    }

    func testSocketCreatedWithBrowserBuilder() {
        var socket: (NSOutputStream, NSInputStream)?

        let _: BrowserVirtualSocketBuilder = createSocket(session) {
            [weak socketCreatedExpectation] receivedSocket, error in
            socket = receivedSocket
            socketCreatedExpectation?.fulfill()
        }

        let socketCreatedTimeout = 2.0
        waitForExpectationsWithTimeout(socketCreatedTimeout, handler: nil)
        XCTAssertNotNil(socket)
    }

    func testReceivedWrongInputStreamNameForBrowserBuilder() {
        session.simulateRelay = false
        var error: ErrorType?

        let _: BrowserVirtualSocketBuilder = createSocket(session) {
            [weak socketCreatedExpectation] receivedSocket, err in
            error = err
            socketCreatedExpectation?.fulfill()
        }

        let socketCreatedTimeout = 2.0
        waitForExpectationsWithTimeout(socketCreatedTimeout, handler: nil)
        XCTAssertNotNil(error)
    }
}
