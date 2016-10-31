//
//  Thali CordovaPlugin
//  VirtualSocketBuilderTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import MultipeerConnectivity
@testable import ThaliCore
import XCTest

class VirtualSocketBuilderTests: XCTestCase {

    // MARK: - State
    var mcPeerID: MCPeerID!
    var mcSessionMock: MCSessionMock!
    var nonTCPSession: Session!

    let streamReceivedTimeout: NSTimeInterval = 5.0
    let connectionErrorTimeout: NSTimeInterval = 10.0

    // MARK: - Setup & Teardown
    override func setUp() {
        super.setUp()
        mcPeerID = MCPeerID(displayName: String.random(length: 5))
        mcSessionMock = MCSessionMock(peer: MCPeerID(displayName: String.random(length: 5)))
        nonTCPSession = Session(session: mcSessionMock,
                                identifier: mcPeerID,
                                connected: {},
                                notConnected: {})
    }

    override func tearDown() {
        mcPeerID = nil
        mcSessionMock = nil
        nonTCPSession = nil
        super.tearDown()
    }

    // MARK: - Tests
    func testAdvertiserSocketBuilderCreatesVirtualSocket() {
        // Expectations
        let virtualSocketCreated = expectationWithDescription("Virtual socket is created")

        // Given
        let socketBuilder = AdvertiserVirtualSocketBuilder(with: nonTCPSession) {
            virtualSocket, error in
            XCTAssertNil(error, "Virtual Socket is not created")
            virtualSocketCreated.fulfill()
        }

        let emptyData = NSData(bytes: nil, length: 0)
        let emptyInputStream = NSInputStream(data: emptyData)
        let randomlyGeneratedStreamName = NSUUID().UUIDString

        mcSessionMock.delegate?.session(mcSessionMock,
                                        didReceiveStream: emptyInputStream,
                                        withName: randomlyGeneratedStreamName,
                                        fromPeer: mcPeerID)

        // When
        socketBuilder.createVirtualSocket(with: emptyInputStream,
                                          inputStreamName: randomlyGeneratedStreamName)

        // Then
        waitForExpectationsWithTimeout(streamReceivedTimeout, handler: nil)
    }

    func testConnectionTimeoutErrorWhenBrowserSocketBuilderTimeout() {
        // Expectations
        let gotConnectionTimeoutErrorReturned =
            expectationWithDescription("Got .ConnectionTimeout error")

        // Given
        let socketBuilder =
            BrowserVirtualSocketBuilder(with: nonTCPSession,
                                        streamName: NSUUID().UUIDString,
                                        streamReceivedBackTimeout: streamReceivedTimeout)

        // When
        socketBuilder.startBuilding {
            virtualSocket, error in
            XCTAssertNotNil(error, "Got error in completion")

            guard let thaliCoreError = error as? ThaliCoreError else {
                XCTFail("Error in completion is not ThaliCoreError")
                return
            }

            XCTAssertEqual(thaliCoreError,
                           ThaliCoreError.ConnectionTimedOut,
                           "ThaliCoreError in completion is not ConnectionTimeout error")
            gotConnectionTimeoutErrorReturned.fulfill()
        }

        // Then
        waitForExpectationsWithTimeout(connectionErrorTimeout, handler: nil)
    }

    func testConnectionFailedErrorWhenBrowserSocketBuilderCantStartStream() {
        // Expectations
        let gotConnectionFailedErrorReturned =
            expectationWithDescription("Got .ConnectionFailed error")

        // Given
        mcSessionMock.errorOnStartStream = true
        let socketBuilder =
            BrowserVirtualSocketBuilder(with: nonTCPSession,
                                        streamName: NSUUID().UUIDString,
                                        streamReceivedBackTimeout: streamReceivedTimeout)

        // When
        socketBuilder.startBuilding {
            virtualSocket, error in
            XCTAssertNotNil(error, "Got error in completion")

            guard let thaliCoreError = error as? ThaliCoreError else {
                XCTFail("Error in completion is not ThaliCoreError")
                return
            }

            XCTAssertEqual(thaliCoreError,
                           ThaliCoreError.ConnectionFailed,
                           "ThaliCoreError in completion is not ConnectionFailed error")
            gotConnectionFailedErrorReturned.fulfill()
        }

        // Then
        waitForExpectationsWithTimeout(streamReceivedTimeout, handler: {
            error in
        })
    }
}
