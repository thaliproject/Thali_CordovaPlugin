//
//  Thali CordovaPlugin
//  TCPListenerTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import XCTest
@testable import ThaliCore

class TCPListenerTests: XCTestCase {

  // MARK: - State
  var randomMessage: String!

  let anyAvailablePort: UInt16 = 0

  let startListeningTimeout: NSTimeInterval = 5.0
  let stopListeningTimeout: NSTimeInterval = 5.0
  let acceptConnectionTimeout: NSTimeInterval = 5.0
  let readDataTimeout: NSTimeInterval = 5.0
  let disconnectTimeout: NSTimeInterval = 5.0

  // MARK: - Setup & Teardown
  override func setUp() {
    super.setUp()
    let fullMessageLength = 1 * 1024
    randomMessage = String.random(length: fullMessageLength)
  }

  override func tearDown() {
    randomMessage = nil
    super.tearDown()
  }

  // MARK: - Tests
  func testAcceptNewConnectionHandlerInvoked() {
    // Expectations
    var TCPListenerIsListening: XCTestExpectation?
    var acceptNewConnectionHandlerInvoked: XCTestExpectation?

    // Given
    TCPListenerIsListening = expectationWithDescription("TCP Listener is listenining")

    var listenerPort: UInt16? = nil
    let tcpListener = TCPListener(with: unexpectedReadDataHandler,
                                  socketDisconnected: { _ in },
                                  stoppedListening: unexpectedStopListeningHandler)
    tcpListener.startListeningForConnections(on: anyAvailablePort,
                                             connectionAccepted: {
                                               socket in
                                               acceptNewConnectionHandlerInvoked?.fulfill()
                                             }) {
      port, error in
      XCTAssertNil(error)
      XCTAssertNotNil(port)
      listenerPort = port
      TCPListenerIsListening?.fulfill()
    }

    waitForExpectationsWithTimeout(startListeningTimeout) {
      error in
      TCPListenerIsListening = nil
    }

    // Connecting to listener with TCP mock client
    acceptNewConnectionHandlerInvoked =
      expectationWithDescription("acceptNewConnectionHandler invoked")

    guard let portToConnect = listenerPort else {
      XCTFail("Listener port is nil")
      return
    }

    let clientMock = TCPClientMock(didReadData: unexpectedReadDataHandler,
                                   didConnect: {},
                                   didDisconnect: { _ in })
    // When
    clientMock.connectToLocalHost(on: portToConnect, errorHandler: unexpectedErrorHandler)

    // Then
    waitForExpectationsWithTimeout(acceptConnectionTimeout) {
      error in
      acceptNewConnectionHandlerInvoked = nil
    }
  }

  func testReadDataHandlerInvoked() {
    // Expectations
    var TCPListenerIsListening: XCTestExpectation?
    var acceptNewConnectionHandlerInvoked: XCTestExpectation?
    var readDataHandlerInvoked: XCTestExpectation?

    // Given
    TCPListenerIsListening = expectationWithDescription("TCP Listener is listenining")

    var listenerPort: UInt16? = nil
    let tcpListener = TCPListener(with: {
                                    socket, data in

                                    let receivedMessage = String(data: data,
                                                                 encoding: NSUTF8StringEncoding)
                                    XCTAssertEqual(self.randomMessage,
                                                   receivedMessage,
                                                   "Received message is wrong")
                                    readDataHandlerInvoked?.fulfill()
                                  },
                                  socketDisconnected: { _ in },
                                  stoppedListening: unexpectedStopListeningHandler)

    tcpListener.startListeningForConnections(on: anyAvailablePort,
                                             connectionAccepted: {
                                               socket in
                                               socket.readDataWithTimeout(-1, tag: 0)
                                               acceptNewConnectionHandlerInvoked?.fulfill()
                                             }) {
      port, error in
      XCTAssertNil(error)
      XCTAssertNotNil(port)
      listenerPort = port
      TCPListenerIsListening?.fulfill()
    }

    waitForExpectationsWithTimeout(acceptConnectionTimeout) {
      error in
      TCPListenerIsListening = nil
    }

    // Connecting to listener with TCP mock client
    acceptNewConnectionHandlerInvoked =
      expectationWithDescription("acceptNewConnectionHandler invoked")

    guard let portToConnect = listenerPort else {
      XCTFail("Listener port is nil")
      return
    }

    let clientMock = TCPClientMock(didReadData: unexpectedReadDataHandler,
                                   didConnect: {},
                                   didDisconnect: unexpectedDisconnectHandler)

    clientMock.connectToLocalHost(on: portToConnect, errorHandler: unexpectedErrorHandler)

    waitForExpectationsWithTimeout(acceptConnectionTimeout) {
      error in
      acceptNewConnectionHandlerInvoked = nil
    }

    // Send some data into socket
    readDataHandlerInvoked = expectationWithDescription("readDataHandler invoked")

    // When
    clientMock.send(randomMessage)

    // Then
    waitForExpectationsWithTimeout(readDataTimeout) {
      error in
      readDataHandlerInvoked = nil
    }
  }

  func testDisconnectHandlerInvoked() {
    // Expectations
    var TCPListenerIsListening: XCTestExpectation?
    var acceptNewConnectionHandlerInvoked: XCTestExpectation?
    var disconnectHandlerInvoked: XCTestExpectation?

    // Given
    TCPListenerIsListening = expectationWithDescription("TCP Listener is listenining")

    var listenerPort: UInt16? = nil
    let tcpListener = TCPListener(with: unexpectedReadDataHandler,
                                  socketDisconnected: {
                                    socket in
                                    disconnectHandlerInvoked?.fulfill()
                                  },
                                  stoppedListening: unexpectedStopListeningHandler)
    tcpListener.startListeningForConnections(on: anyAvailablePort,
                                             connectionAccepted: {
                                               _ in
                                               acceptNewConnectionHandlerInvoked?.fulfill()
                                             }) {
      port, error in
      XCTAssertNil(error)
      XCTAssertNotNil(port)
      listenerPort = port
      TCPListenerIsListening?.fulfill()
    }

    waitForExpectationsWithTimeout(startListeningTimeout) {
      error in
      TCPListenerIsListening = nil
    }

    // Connecting to listener with TCP mock client
    acceptNewConnectionHandlerInvoked =
      expectationWithDescription("acceptNewConnectionHandler invoked")

    guard let portToConnect = listenerPort else {
      XCTFail("Listener port is nil")
      return
    }

    let clientMock = TCPClientMock(didReadData: unexpectedReadDataHandler,
                                   didConnect: {},
                                   didDisconnect: {})

    clientMock.connectToLocalHost(on: portToConnect, errorHandler: unexpectedErrorHandler)

    waitForExpectationsWithTimeout(acceptConnectionTimeout) {
      error in
      acceptNewConnectionHandlerInvoked = nil
    }

    // Client initiate disconnect
    disconnectHandlerInvoked = expectationWithDescription("disconnectHandler invoked")

    // When
    clientMock.disconnect()

    // Then
    waitForExpectationsWithTimeout(disconnectTimeout) {
      error in
      disconnectHandlerInvoked = nil
    }
  }

  func testTCPListenerCantListenOnBusyPortAndReturnsZeroPort() {
    // Expectations
    var TCPListenerIsListening: XCTestExpectation?
    var TCPListenerCantStartListening: XCTestExpectation?

    // Given
    TCPListenerIsListening =
      expectationWithDescription("TCP Listener is listenining")

    var listenerPort: UInt16? = nil
    let firstTcpListener = TCPListener(with: unexpectedReadDataHandler,
                                       socketDisconnected: unexpectedSocketDisconnectHandler,
                                       stoppedListening: unexpectedStopListeningHandler)
    firstTcpListener.startListeningForConnections(
                                          on: anyAvailablePort,
                                          connectionAccepted: unexpectedAcceptConnectionHandler) {
      port, error in
      XCTAssertNil(error)
      XCTAssertNotNil(port)
      listenerPort = port
      TCPListenerIsListening?.fulfill()
    }

    waitForExpectationsWithTimeout(startListeningTimeout) {
      error in
      TCPListenerIsListening = nil
    }

    guard let busyPort = listenerPort else {
      XCTFail("Listener port is nil")
      return
    }

    // Trying start listening on busy port
    TCPListenerCantStartListening = expectationWithDescription("TCP Listener can't start listener")

    let secondTcpListener = TCPListener(with: unexpectedReadDataHandler,
                                        socketDisconnected: unexpectedSocketDisconnectHandler,
                                        stoppedListening: unexpectedStopListeningHandler)

    // When
    secondTcpListener.startListeningForConnections(
                                          on: busyPort,
                                          connectionAccepted: unexpectedAcceptConnectionHandler) {
      port, error in
      XCTAssertNotNil(error)
      XCTAssertEqual(0, port)
      TCPListenerCantStartListening?.fulfill()
    }

    // Then
    waitForExpectationsWithTimeout(startListeningTimeout) {
      error in
      TCPListenerCantStartListening = nil
    }
  }

  func testStopListeningForConnectionsReleasesPort() {
    // Expectations
    var TCPListenerIsListening: XCTestExpectation?
    var TCPListenerIsStopped: XCTestExpectation?

    // Given
    TCPListenerIsListening = expectationWithDescription("TCP Listener is listenining")

    var listenerPort: UInt16? = nil
    let firstTcpListener = TCPListener(with: unexpectedReadDataHandler,
                                       socketDisconnected: unexpectedSocketDisconnectHandler,
                                       stoppedListening: {
                                        TCPListenerIsStopped?.fulfill()
                                       })
    firstTcpListener.startListeningForConnections(
                                          on: anyAvailablePort,
                                          connectionAccepted: unexpectedAcceptConnectionHandler) {
      port, error in
      XCTAssertNil(error)
      XCTAssertNotNil(port)
      listenerPort = port
      TCPListenerIsListening?.fulfill()
    }

    waitForExpectationsWithTimeout(startListeningTimeout) {
      error in
      TCPListenerIsListening = nil
    }

    TCPListenerIsStopped = expectationWithDescription("TCP Listener is stopped")
    firstTcpListener.stopListeningForConnectionsAndDisconnectClients()
    waitForExpectationsWithTimeout(stopListeningTimeout) {
      error in
      TCPListenerIsStopped = nil
    }

    guard let potentiallyReleasedPort = listenerPort else {
      XCTFail("Listener port is nil")
      return
    }

    // Trying to connect to busy port
    TCPListenerIsListening = expectationWithDescription("TCP Listener is listenining")

    let secondTcpListener = TCPListener(with: unexpectedReadDataHandler,
                                        socketDisconnected: unexpectedSocketDisconnectHandler,
                                        stoppedListening: unexpectedStopListeningHandler)

    // When
    secondTcpListener.startListeningForConnections(
                                          on: potentiallyReleasedPort,
                                          connectionAccepted: unexpectedAcceptConnectionHandler) {
        port, error in
        XCTAssertNil(error)
        XCTAssertNotNil(port)
        TCPListenerIsListening?.fulfill()
    }

    // Then
    waitForExpectationsWithTimeout(startListeningTimeout) {
      error in
      TCPListenerIsListening = nil
    }
  }

  func testStopListeningForConnectionsDisconnectsClient() {
    // Expectations
    var TCPListenerIsListening: XCTestExpectation?
    var acceptNewConnectionHandlerInvoked: XCTestExpectation?
    var clientDisconnectHandlerInvoked: XCTestExpectation?

    // Given
    TCPListenerIsListening = expectationWithDescription("TCP Listener is listenining")

    var listenerPort: UInt16? = nil
    let tcpListener = TCPListener(with: unexpectedReadDataHandler,
                                  socketDisconnected: {
                                    socket in
                                  },
                                  stoppedListening: {})
    tcpListener.startListeningForConnections(on: anyAvailablePort,
                                             connectionAccepted: {
                                                _ in
                                                acceptNewConnectionHandlerInvoked?.fulfill()
                                              }) {
      port, error in
      XCTAssertNil(error)
      XCTAssertNotNil(port)
      listenerPort = port
      TCPListenerIsListening?.fulfill()
    }

    waitForExpectationsWithTimeout(startListeningTimeout) {
      error in
      TCPListenerIsListening = nil
    }

    // Connecting to listener with TCP mock client
    acceptNewConnectionHandlerInvoked =
      expectationWithDescription("acceptNewConnectionHandler invoked")

    guard let portToConnect = listenerPort else {
      XCTFail("Listener port is nil")
      return
    }

    let clientMock = TCPClientMock(didReadData: unexpectedReadDataHandler,
                                   didConnect: {},
                                   didDisconnect: {
                                     clientDisconnectHandlerInvoked?.fulfill()
                                   })

    clientMock.connectToLocalHost(on: portToConnect, errorHandler: unexpectedErrorHandler)

    waitForExpectationsWithTimeout(acceptConnectionTimeout) {
      error in
      acceptNewConnectionHandlerInvoked = nil
    }

    clientDisconnectHandlerInvoked = expectationWithDescription("Client's didDisconnect invoked")

    // When
    tcpListener.stopListeningForConnectionsAndDisconnectClients()

    // Then
    waitForExpectationsWithTimeout(disconnectTimeout) {
      error in
      clientDisconnectHandlerInvoked = nil
    }
  }

  func testStopListeningForConnectionsCalledTwice() {
    // Expectations
    var TCPListenerIsListening: XCTestExpectation?
    var acceptNewConnectionHandlerInvoked: XCTestExpectation?
    var clientDisconnectHandlerInvoked: XCTestExpectation?

    // Given
    TCPListenerIsListening = expectationWithDescription("TCP Listener is listenining")

    var listenerPort: UInt16? = nil
    let tcpListener = TCPListener(with: unexpectedReadDataHandler,
                                  socketDisconnected: {
                                    socket in
                                  },
                                  stoppedListening: {})
    tcpListener.startListeningForConnections(on: anyAvailablePort,
                                             connectionAccepted: {
                                               _ in
                                               acceptNewConnectionHandlerInvoked?.fulfill()
                                             }) {
      port, error in
      XCTAssertNil(error)
      XCTAssertNotNil(port)
      listenerPort = port
      TCPListenerIsListening?.fulfill()
    }

    waitForExpectationsWithTimeout(startListeningTimeout) {
      error in
      TCPListenerIsListening = nil
    }

    // Connecting to listener with TCP mock client
    acceptNewConnectionHandlerInvoked =
      expectationWithDescription("acceptNewConnectionHandler invoked")

    guard let portToConnect = listenerPort else {
      XCTFail("Listener port is nil")
      return
    }

    let clientMock = TCPClientMock(didReadData: unexpectedReadDataHandler,
                                   didConnect: {},
                                   didDisconnect: {
                                     clientDisconnectHandlerInvoked?.fulfill()
                                   })

    clientMock.connectToLocalHost(on: portToConnect, errorHandler: unexpectedErrorHandler)

    waitForExpectationsWithTimeout(acceptConnectionTimeout) {
      error in
      acceptNewConnectionHandlerInvoked = nil
    }

    clientDisconnectHandlerInvoked = expectationWithDescription("Client's didDisconnect invoked")

    // When
    tcpListener.stopListeningForConnectionsAndDisconnectClients()
    tcpListener.stopListeningForConnectionsAndDisconnectClients()

    // Then
    waitForExpectationsWithTimeout(disconnectTimeout) {
      error in
      clientDisconnectHandlerInvoked = nil
    }
  }
}

// MARK: - GCDAsyncSocketDelegate
extension TCPListenerTests: GCDAsyncSocketDelegate {

  func socket(sock: GCDAsyncSocket, didConnectToHost host: String, port: UInt16) {}
  func socketDidDisconnect(sock: GCDAsyncSocket, withError err: NSError?) {}
  func socket(sock: GCDAsyncSocket, didWriteDataWithTag tag: Int) {}
  func socketDidCloseReadStream(sock: GCDAsyncSocket) {}
}
