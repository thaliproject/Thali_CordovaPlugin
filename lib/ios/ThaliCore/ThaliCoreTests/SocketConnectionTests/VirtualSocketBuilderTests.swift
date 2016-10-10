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
    var streamReceivedTimeout: NSTimeInterval!
    var nonTCPSession: Session!

    // MARK: - Setup
    override func setUp() {
        mcPeerID = MCPeerID(displayName: String.random(length: 5))
        mcSessionMock = MCSessionMock(peer: MCPeerID(displayName: String.random(length: 5)))
        streamReceivedTimeout = 5.0
        nonTCPSession = Session(session: mcSessionMock,
                                identifier: mcPeerID,
                                connected: {},
                                notConnected: {})
    }

    // MARK: - Tests
    func testAdvertiserSocketBuilderCreatesVirtualSocket() {
        // Expectations
        let virtualSocketCreated = expectationWithDescription("Virtual socket is created")

        // Given
        let _ = AdvertiserVirtualSocketBuilder(with: nonTCPSession) {
            virtualSocket, error in
            XCTAssertNil(error, "Virtual Socket is not created")
            virtualSocketCreated.fulfill()
        }

        let emptyData = NSData(bytes: nil, length: 0)
        let randomlyGeneratedStreamName = NSUUID().UUIDString

        // When
        mcSessionMock.delegate?.session(mcSessionMock,
                                        didReceiveStream: NSInputStream(data: emptyData),
                                        withName: randomlyGeneratedStreamName,
                                        fromPeer: mcPeerID)

        // When
        // TODO: ???

        // Then
        waitForExpectationsWithTimeout(streamReceivedTimeout, handler: nil)
    }

    func testConnectionTimeoutErrorWhenBrowserSocketBuilderTimeout() {
        // Expectations
        let gotConnectionTimeoutErrorReturned = expectationWithDescription("Got .ConnectionTimeout error")

        // Given
        let b = BrowserVirtualSocketBuilder (with: nonTCPSession,
                                            streamName: NSUUID().UUIDString,
                                            streamReceivedBackTimeout: streamReceivedTimeout)

        b.startBuilding {
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

        // When
        // didReceiveStream on MCSessionDelegate was not invoked

        // Then
        waitForExpectationsWithTimeout(streamReceivedTimeout, handler: nil)
    }

    func testConnectionFailedErrorWhenBrowserSocketBuilderReceivedWrongInputStream() {
        // Given
        let gotConnectionFailedErrorReturned =
            expectationWithDescription("Got .ConnectionFailed error")

        let b = BrowserVirtualSocketBuilder(with: nonTCPSession,
                                            streamName: NSUUID().UUIDString,
                                            streamReceivedBackTimeout: streamReceivedTimeout)

        b.startBuilding {
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

        let emptyData = NSData(bytes: nil, length: 0)
        let randomlyGeneratedStreamName = NSUUID().UUIDString

        // When
        // Fake invocation of delegate method
        mcSessionMock.delegate?.session(mcSessionMock,
                                        didReceiveStream: NSInputStream(data: emptyData),
                                        withName: randomlyGeneratedStreamName,
                                        fromPeer: mcPeerID)

        // Then
        waitForExpectationsWithTimeout(streamReceivedTimeout, handler: nil)
    }

    func testConnectionFailedErrorWhenAdvertiserSocketBuilderCantStartStream() {
        // Given
        let gotConnectionFailedErrorReturned =
            expectationWithDescription("Got .ConnectionFailed error")

        mcSessionMock.errorOnStartStream = true

        // When
        let b = BrowserVirtualSocketBuilder(with: nonTCPSession,
                                            streamName: NSUUID().UUIDString,
                                            streamReceivedBackTimeout: streamReceivedTimeout)

        b.startBuilding {
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
        waitForExpectationsWithTimeout(streamReceivedTimeout, handler: nil)
    }
}
