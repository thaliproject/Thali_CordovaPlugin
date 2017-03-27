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

  let streamReceivedTimeout: TimeInterval = 5.0
  let connectionErrorTimeout: TimeInterval = 10.0

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
    let virtualSocketCreated = expectation(description: "Virtual socket is created")

    // Given
    let socketBuilder = AdvertiserVirtualSocketBuilder(with: nonTCPSession) {
      virtualSocket, error in
      XCTAssertNil(error, "Virtual Socket is not created")
      virtualSocketCreated.fulfill()
    }

    let emptyData = Data(bytes: [], count: 0)
    let emptyInputStream = InputStream(data: emptyData)
    let randomlyGeneratedStreamName = UUID().uuidString

    mcSessionMock.delegate?.session(mcSessionMock,
                                    didReceive: emptyInputStream,
                                    withName: randomlyGeneratedStreamName,
                                    fromPeer: mcPeerID)

    // When
    socketBuilder.createVirtualSocket(with: emptyInputStream,
                                      inputStreamName: randomlyGeneratedStreamName)

    // Then
    waitForExpectations(timeout: streamReceivedTimeout, handler: nil)
  }

  func testConnectionTimeoutErrorWhenBrowserSocketBuilderTimeout() {
    // Expectations
    let gotConnectionTimeoutErrorReturned = expectation(description: "Got .ConnectionTimeout error")

    // Given
    let socketBuilder =
      BrowserVirtualSocketBuilder(with: nonTCPSession,
                                  streamName: UUID().uuidString,
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
    waitForExpectations(timeout: connectionErrorTimeout, handler: nil)
  }

  func testConnectionFailedErrorWhenBrowserSocketBuilderCantStartStream() {
    // Expectations
    let gotConnectionFailedErrorReturned = expectation(description: "Got .ConnectionFailed error")

    // Given
    mcSessionMock.errorOnStartStream = true
    let socketBuilder =
      BrowserVirtualSocketBuilder(with: nonTCPSession,
                                  streamName: UUID().uuidString,
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
    waitForExpectations(timeout: streamReceivedTimeout, handler: {
      error in
    })
  }
}
