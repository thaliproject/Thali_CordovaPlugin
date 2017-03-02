//
//  Thali CordovaPlugin
//  SessionTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import XCTest
@testable import ThaliCore
import MultipeerConnectivity

class SessionTests: XCTestCase {

  // MARK: - State
  var peerID: MCPeerID!
  var mcSession: MCSessionMock!
  var disconnected: XCTestExpectation!

  let connectTimeout: TimeInterval = 5.0
  let disconnectTimeout: TimeInterval = 5.0
  let receiveInputStreamTimeout: TimeInterval = 5.0
  let changeStateTimeout: TimeInterval = 5.0

  // MARK: - Setup & Teardown
  override func setUp() {
    super.setUp()
    peerID = MCPeerID(displayName: String.random(length: 5))
    mcSession = MCSessionMock(peer: MCPeerID(displayName: String.random(length: 5)))
  }

  override func tearDown() {
    peerID = nil
    mcSession = nil
    disconnected = nil
    super.tearDown()
  }

  // MARK: - Tests
  func testSessionStartsWithNotConnectedState() {
    // Given, When
    let session = Session(session: mcSession,
                          identifier: peerID,
                          connected: unexpectedConnectHandler,
                          notConnected: unexpectedDisconnectHandler)

    // Then
    XCTAssertEqual(session.sessionState.value, MCSessionState.notConnected)
  }

  func testMCSessionDelegateMethodWithWhenConnectingParameterChangesState() {
    // Given
    let session = Session(session: mcSession,
                          identifier: peerID,
                          connected: unexpectedConnectHandler,
                          notConnected: unexpectedDisconnectHandler)
    // When
    // Fake invocation of delegate method
    mcSession.delegate?.session(mcSession, peer: peerID, didChange: .connecting)

    // Then
    XCTAssertEqual(session.sessionState.value, MCSessionState.connecting)
  }

  func testMCSessionDelegateMethodWithWhenConnectedParameterChangesState() {
    // Given
    let session = Session(session: mcSession,
                          identifier: peerID,
                          connected: {},
                          notConnected: unexpectedDisconnectHandler)
    // When
    // Fake invocation of delegate method
    mcSession.delegate?.session(mcSession, peer: peerID, didChange: .connected)

    // Then
    XCTAssertEqual(session.sessionState.value, MCSessionState.connected)
  }

  func testMCSessionDelegateMethodWithWhenNotConnectedParameterChangesState() {
    // Given
    let session = Session(session: mcSession,
                          identifier: peerID,
                          connected: unexpectedConnectHandler,
                          notConnected: {})
    // When
    // Fake invocation of delegate method
    mcSession.delegate?.session(mcSession, peer: peerID, didChange: .notConnected)

    // Then
    XCTAssertEqual(session.sessionState.value, MCSessionState.notConnected)
  }

  func testConnectHandlerInvokedWhenMCSessionStateChangesToConnected() {
    // Expectations
    var connectHandlerInvoked: XCTestExpectation? =
      expectation(description: "connectHandler invoked")

    // Given
    let session = Session(session: mcSession,
                          identifier: peerID,
                          connected: {
                            [weak connectHandlerInvoked] in
                            connectHandlerInvoked?.fulfill()
      },
                          notConnected: unexpectedDisconnectHandler)

    // When
    // Fake invocation of delegate method
    mcSession.delegate?.session(mcSession, peer: peerID, didChange: .connected)

    // Then
    waitForExpectations(timeout: connectTimeout) {
      error in
      connectHandlerInvoked = nil
    }
    XCTAssertEqual(session.sessionState.value, MCSessionState.connected)
  }

  func testDisconnectHandlerInvokedWhenMCSessionStateChangesToDisconnected() {
    // Expectations
    var disconnectHandlerInvoked: XCTestExpectation? =
      expectation(description: "disconnectHandler invoked")

    // Given
    let session = Session(session: mcSession,
                          identifier: peerID,
                          connected: unexpectedConnectHandler,
                          notConnected: {
                            [weak disconnectHandlerInvoked] in
                            disconnectHandlerInvoked?.fulfill()
      })

    // When
    // Fake invocation of delegate method
    mcSession.delegate?.session(mcSession, peer: peerID, didChange: .notConnected)

    // Then
    waitForExpectations(timeout: disconnectTimeout) {
      error in
      disconnectHandlerInvoked = nil
    }
    XCTAssertEqual(session.sessionState.value, MCSessionState.notConnected)
  }

  func testConnectAndDisconnectHandlersNotInvokedWhenMCSessionStateChangesToConnecting() {
    // Given
    let session = Session(session: mcSession,
                          identifier: peerID,
                          connected: unexpectedConnectHandler,
                          notConnected: unexpectedDisconnectHandler)

    // When
    // Fake invocation of delegate method
    mcSession.delegate?.session(mcSession, peer: peerID, didChange: .connecting)

    // Then
    XCTAssertEqual(session.sessionState.value, MCSessionState.connecting)
  }

  func testDidReceiveInputStreamHandlerInvokedWhenMCSessionDelegateReceiveInputStream() {
    // Expectations
    var didReceiveInputStreamHandlerInvoked: XCTestExpectation?

    // Given
    let session = Session(session: mcSession,
                          identifier: peerID,
                          connected: unexpectedConnectHandler,
                          notConnected: unexpectedDisconnectHandler)

    didReceiveInputStreamHandlerInvoked =
      expectation(description: "Session's didReceiveInputStreamHandler invoked")

    var receivedStreamName: String?
    session.didReceiveInputStreamHandler = {
      [weak didReceiveInputStreamHandlerInvoked] stream, name in

      receivedStreamName = name
      didReceiveInputStreamHandlerInvoked?.fulfill()
    }

    let emptyData = Data(bytes: [], count: 0)
    let randomlyGeneratedStreamName = UUID().uuidString

    // When
    // Fake invocation of delegate method
    mcSession.delegate?.session(mcSession,
                                didReceive: InputStream(data: emptyData),
                                withName: randomlyGeneratedStreamName,
                                fromPeer: peerID)

    // Then
    waitForExpectations(timeout: receiveInputStreamTimeout) {
      error in
      didReceiveInputStreamHandlerInvoked = nil
    }
    XCTAssertEqual(randomlyGeneratedStreamName, receivedStreamName)
  }

  func testDidChangeStateHandlerInvokedWhenMCSessionStateChanges() {
    // Expectations
    var didChangeStateHandlerInvoked: XCTestExpectation? =
      expectation(description: "session's didChangeStateHandler invoked")

    // Given
    let session = Session(session: mcSession,
                          identifier: peerID,
                          connected: unexpectedConnectHandler,
                          notConnected: unexpectedDisconnectHandler)

    session.didChangeStateHandler = {
      [weak didChangeStateHandlerInvoked] state in
      didChangeStateHandlerInvoked?.fulfill()
    }

    // When
    // Fake invocation of delegate method
    mcSession.delegate?.session(mcSession, peer: peerID, didChange: .connecting)

    // Then
    waitForExpectations(timeout: changeStateTimeout) {
      error in
      didChangeStateHandlerInvoked = nil
    }
    XCTAssertEqual(session.sessionState.value, MCSessionState.connecting)
  }

  func testCreateOutputStreamMethodThrowsThaliCoreError() {
    // Given
    mcSession.errorOnStartStream = true

    let session = Session(session: mcSession,
                          identifier: peerID,
                          connected: {},
                          notConnected: unexpectedDisconnectHandler)

    do {
      // When
      let outputStreamName = UUID().uuidString
      let _ = try session.startOutputStream(with: outputStreamName)
      XCTFail("startOutputStream method threw error, but this is not ThaliCoreError")
    } catch let error {
      // Then
      guard let error = error as? ThaliCoreError else {
        XCTFail("startOutputStream method threw error, but this is not ThaliCoreError")
        return
      }
      XCTAssertEqual(error, ThaliCoreError.ConnectionFailed)
    }
  }
}
