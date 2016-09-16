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

    private var identifier: MCPeerID
    private var session: MCSession
    private var outputStreamName: String?

    var simulateRelay: Bool = true

    var mockState: MCSessionState = .Connected {
        didSet {
            self.session(session, peer: identifier, didChangeState: mockState)
        }
    }

    override var sessionState: Atomic<MCSessionState> {
        return Atomic(mockState)
    }

    override var didReceiveInputStreamHandler: ((NSInputStream, String) -> Void)? {
        didSet {
            didReceiveInputStreamHandler?(NSInputStream(data: NSData(bytes: nil, length: 0)),
                                          getInputStreamName())
        }
    }

    var simulateCreateOutputStreamError: Bool = false

    override init(session: MCSession, identifier: MCPeerID, disconnectHandler: () -> Void) {
        self.session = session
        self.identifier = identifier
        super.init(session: session, identifier: identifier, disconnectHandler: disconnectHandler)
    }

    func getInputStreamName() -> String {
        print(outputStreamName)
        guard let streamName = outputStreamName where simulateRelay else {
            return ""
        }
        return streamName
    }

    override func createOutputStream(withName name: String) throws -> NSOutputStream {
        guard !simulateCreateOutputStreamError else {
            throw NSError(domain: "org.thaliproject.testError", code: 42, userInfo: nil)
        }
        print(name)
        outputStreamName = name
        return NSOutputStream(toBuffer: nil, capacity: 0)
    }
}

class VirtualSocketBuilderTests: XCTestCase {

    var socketCompletionHandlerCalledExpectation: XCTestExpectation!
    var session: SessionMock!

    override func setUp() {
        super.setUp()
        socketCompletionHandlerCalledExpectation = expectationWithDescription("Socket created")
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
            [weak socketCompletionHandlerCalledExpectation] receivedSocket, error in
            socket = receivedSocket
            socketCompletionHandlerCalledExpectation?.fulfill()
        }

        let socketCreatedTimeout = 2.0
        waitForExpectationsWithTimeout(socketCreatedTimeout, handler: nil)
        XCTAssertNotNil(socket)
    }

    func testSocketCreatedWithBrowserBuilderBeforeConnectedState() {
        session.mockState = .NotConnected
        var socket: (NSOutputStream, NSInputStream)?

        let _: BrowserVirtualSocketBuilder = createSocket(session) {
            [weak socketCompletionHandlerCalledExpectation] receivedSocket, error in
            socket = receivedSocket
            socketCompletionHandlerCalledExpectation?.fulfill()
        }
        session.mockState = .Connected

        let socketCreatedTimeout = 2.0
        waitForExpectationsWithTimeout(socketCreatedTimeout, handler: nil)
        XCTAssertNotNil(socket)
    }

    func testSocketCreatedWithBrowserBuilderAfterConnectedState() {
        var socket: (NSOutputStream, NSInputStream)?

        session.mockState = .Connected
        let _: BrowserVirtualSocketBuilder = createSocket(session) {
            [weak socketCompletionHandlerCalledExpectation] receivedSocket, error in
            socket = receivedSocket
            socketCompletionHandlerCalledExpectation?.fulfill()
        }

        let socketCreatedTimeout = 2.0
        waitForExpectationsWithTimeout(socketCreatedTimeout, handler: nil)
        XCTAssertNotNil(socket)
    }

    func testReceivedWrongInputStreamNameForBrowserBuilder() {
        session.simulateRelay = false
        var error: ErrorType?

        let _: BrowserVirtualSocketBuilder = createSocket(session) {
            [weak socketCompletionHandlerCalledExpectation] receivedSocket, err in
            error = err
            socketCompletionHandlerCalledExpectation?.fulfill()
        }

        let socketCreatedTimeout = 2.0
        waitForExpectationsWithTimeout(socketCreatedTimeout, handler: nil)
        XCTAssertNotNil(error)
    }

    func testReceiveErrorOnCreateBrowserOutputStream() {
        session.simulateCreateOutputStreamError = true
        var error: ErrorType?

        let _: BrowserVirtualSocketBuilder = createSocket(session) {
            [weak socketCompletionHandlerCalledExpectation] receivedSocket, err in
            error = err
            socketCompletionHandlerCalledExpectation?.fulfill()
        }

        let receiveErrorTimeout = 2.0
        waitForExpectationsWithTimeout(receiveErrorTimeout, handler: nil)
        XCTAssertNotNil(error)
    }

    func testReceiveErrorOnCreateAdvertiserOutputStream() {
        session.simulateCreateOutputStreamError = true
        var error: ErrorType?

        let _: AdvertiserVirtualSocketBuilder = createSocket(session) {
            [weak socketCompletionHandlerCalledExpectation] receivedSocket, err in
            error = err
            socketCompletionHandlerCalledExpectation?.fulfill()
        }

        let socketCreatedTimeout = 2.0
        waitForExpectationsWithTimeout(socketCreatedTimeout, handler: nil)
        XCTAssertNotNil(error)
    }
}
