//
//  Thali CordovaPlugin
//  VirtualSocketTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import MultipeerConnectivity
@testable import ThaliCore
import XCTest

class VirtualSocketTests: XCTestCase {

  // MARK: - State
  var mcPeerID: MCPeerID!
  var mcSessionMock: MCSessionMock!
  var nonTCPSession: Session!

  let streamReceivedTimeout: TimeInterval = 5.0
  let virtualSocketOpenTimeout: TimeInterval = 5.0
  let virtualSocketCloseTimeout: TimeInterval = 5.0

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
  func testVirtualSocketCreatedWithClosedState() {
    // Given
    do {
      let ouputStream = try nonTCPSession.startOutputStream(with: "test")

      let emptyData = Data(bytes: [], count: 0)
      let inputStream = InputStream(data: emptyData)

      // When
      let virtualSocket = VirtualSocket(with: inputStream, outputStream: ouputStream)

      // Then
      XCTAssertFalse(virtualSocket.opened)
    } catch {
      XCTFail("Can't create output stream on mock Session")
    }
  }

  func testVirtualSocketOpenStreamsChangesState() {
    // Given
    do {
      let ouputStream = try nonTCPSession.startOutputStream(with: "test")

      let emptyData = Data(bytes: [], count: 0)
      let inputStream = InputStream(data: emptyData)

      let virtualSocket = VirtualSocket(with: inputStream, outputStream: ouputStream)
      XCTAssertFalse(virtualSocket.opened)

      // When
      virtualSocket.openStreams()
      XCTAssertTrue(virtualSocket.opened)
    } catch {
      XCTFail("Can't create output stream on mock Session")
    }
  }

  func testVirtualSocketCloseStreams() {
    // Given
    do {
      let ouputStream = try nonTCPSession.startOutputStream(with: "test")

      let emptyData = Data(bytes: [], count: 0)
      let inputStream = InputStream(data: emptyData)

      let virtualSocket = VirtualSocket(with: inputStream, outputStream: ouputStream)
      XCTAssertFalse(virtualSocket.opened)
      virtualSocket.openStreams()
      XCTAssertTrue(virtualSocket.opened)

      // When
      virtualSocket.closeStreams()

      // Then
      XCTAssertFalse(virtualSocket.opened)
    } catch {
      XCTFail("Can't create output stream on mock Session")
    }
  }

  func testOpenStreamsCalledTwiceChangesStateProperly() {
    // Given
    do {
      let ouputStream = try nonTCPSession.startOutputStream(with: "test")

      let emptyData = Data(bytes: [], count: 0)
      let inputStream = InputStream(data: emptyData)

      let virtualSocket = VirtualSocket(with: inputStream, outputStream: ouputStream)
      XCTAssertFalse(virtualSocket.opened)

      // When
      virtualSocket.openStreams()
      virtualSocket.openStreams()

      // Then
      XCTAssertTrue(virtualSocket.opened)

    } catch {
      XCTFail("Can't create output stream on mock Session")
    }
  }

  func testCloseStreamsCalledTwiceChangesStateProperly() {
    // Given
    do {
      let ouputStream = try nonTCPSession.startOutputStream(with: "test")

      let emptyData = Data(bytes: [], count: 0)
      let inputStream = InputStream(data: emptyData)

      let virtualSocket = VirtualSocket(with: inputStream, outputStream: ouputStream)
      XCTAssertFalse(virtualSocket.opened)
      virtualSocket.openStreams()
      XCTAssertTrue(virtualSocket.opened)

      // When
      virtualSocket.closeStreams()
      virtualSocket.closeStreams()

      // Then
      XCTAssertFalse(virtualSocket.opened)

    } catch {
      XCTFail("Can't create output stream on mock Session")
    }
  }
}
