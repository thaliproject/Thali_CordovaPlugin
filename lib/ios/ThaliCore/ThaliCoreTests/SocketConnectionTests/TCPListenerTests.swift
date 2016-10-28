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

  let startListeningTimeout: TimeInterval = 5.0
  let stopListeningTimeout: TimeInterval = 5.0
  let acceptConnectionTimeout: TimeInterval = 5.0
  let readDataTimeout: TimeInterval = 5.0
  let disconnectTimeout: TimeInterval = 5.0

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
    TCPListenerIsListening = expectation(description: "TCP Listener is listenining")

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

    waitForExpectations(timeout: startListeningTimeout) {
      error in
      TCPListenerIsListening = nil
    }

    // Connecting to listener with TCP mock client
    acceptNewConnectionHandlerInvoked =
      expectation(description: "acceptNewConnectionHandler invoked")

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
    waitForExpectations(timeout: acceptConnectionTimeout) {
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
    TCPListenerIsListening = expectation(description: "TCP Listener is listenining")

    var listenerPort: UInt16? = nil
    let tcpListener = TCPListener(with: {
                                    socket, data in

                                    let receivedMessage = String(data: data,
                                                                 encoding: String.Encoding.utf8)
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
                                               socket.readData(withTimeout: -1, tag: 0)
                                               acceptNewConnectionHandlerInvoked?.fulfill()
                                             }) {
      port, error in
      XCTAssertNil(error)
      XCTAssertNotNil(port)
      listenerPort = port
      TCPListenerIsListening?.fulfill()
    }

    waitForExpectations(timeout: acceptConnectionTimeout) {
      error in
      TCPListenerIsListening = nil
    }

    // Connecting to listener with TCP mock client
    acceptNewConnectionHandlerInvoked =
      expectation(description: "acceptNewConnectionHandler invoked")

    guard let portToConnect = listenerPort else {
      XCTFail("Listener port is nil")
      return
    }

    let clientMock = TCPClientMock(didReadData: unexpectedReadDataHandler,
                                   didConnect: {},
                                   didDisconnect: unexpectedDisconnectHandler)

    clientMock.connectToLocalHost(on: portToConnect, errorHandler: unexpectedErrorHandler)

    waitForExpectations(timeout: acceptConnectionTimeout) {
      error in
      acceptNewConnectionHandlerInvoked = nil
    }

    // Send some data into socket
    readDataHandlerInvoked = expectation(description: "readDataHandler invoked")

    // When
    clientMock.send(randomMessage)

    // Then
    waitForExpectations(timeout: readDataTimeout) {
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
    TCPListenerIsListening = expectation(description: "TCP Listener is listenining")

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

    waitForExpectations(timeout: startListeningTimeout) {
      error in
      TCPListenerIsListening = nil
    }

    // Connecting to listener with TCP mock client
    acceptNewConnectionHandlerInvoked =
      expectation(description: "acceptNewConnectionHandler invoked")

    guard let portToConnect = listenerPort else {
      XCTFail("Listener port is nil")
      return
    }

    let clientMock = TCPClientMock(didReadData: unexpectedReadDataHandler,
                                   didConnect: {},
                                   didDisconnect: {})

    clientMock.connectToLocalHost(on: portToConnect, errorHandler: unexpectedErrorHandler)

    waitForExpectations(timeout: acceptConnectionTimeout) {
      error in
      acceptNewConnectionHandlerInvoked = nil
    }

    // Client initiate disconnect
    disconnectHandlerInvoked = expectation(description: "disconnectHandler invoked")

    // When
    clientMock.disconnect()

    // Then
    waitForExpectations(timeout: disconnectTimeout) {
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
      expectation(description: "TCP Listener is listenining")

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

    waitForExpectations(timeout: startListeningTimeout) {
      error in
      TCPListenerIsListening = nil
    }

    guard let busyPort = listenerPort else {
      XCTFail("Listener port is nil")
      return
    }

    // Trying start listening on busy port
    TCPListenerCantStartListening = expectation(description: "TCP Listener can't start listener")

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
    waitForExpectations(timeout: startListeningTimeout) {
      error in
      TCPListenerCantStartListening = nil
    }
  }

  func testStopListeningForConnectionsReleasesPort() {
    // Expectations
    var TCPListenerIsListening: XCTestExpectation?
    var TCPListenerIsStopped: XCTestExpectation?

    // Given
    TCPListenerIsListening = expectation(description: "TCP Listener is listenining")

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

    waitForExpectations(timeout: startListeningTimeout) {
      error in
      TCPListenerIsListening = nil
    }

    TCPListenerIsStopped = expectation(description: "TCP Listener is stopped")
    firstTcpListener.stopListeningForConnectionsAndDisconnectClients()
    waitForExpectations(timeout: stopListeningTimeout) {
      error in
      TCPListenerIsStopped = nil
    }

    guard let potentiallyReleasedPort = listenerPort else {
      XCTFail("Listener port is nil")
      return
    }

    // Trying to connect to busy port
    TCPListenerIsListening = expectation(description: "TCP Listener is listenining")

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
    waitForExpectations(timeout: startListeningTimeout) {
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
    TCPListenerIsListening = expectation(description: "TCP Listener is listenining")

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

    waitForExpectations(timeout: startListeningTimeout) {
      error in
      TCPListenerIsListening = nil
    }

    // Connecting to listener with TCP mock client
    acceptNewConnectionHandlerInvoked =
      expectation(description: "acceptNewConnectionHandler invoked")

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

    waitForExpectations(timeout: acceptConnectionTimeout) {
      error in
      acceptNewConnectionHandlerInvoked = nil
    }

    clientDisconnectHandlerInvoked = expectation(description: "Client's didDisconnect invoked")

    // When
    tcpListener.stopListeningForConnectionsAndDisconnectClients()

    // Then
    waitForExpectations(timeout: disconnectTimeout) {
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
    TCPListenerIsListening = expectation(description: "TCP Listener is listenining")

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

    waitForExpectations(timeout: startListeningTimeout) {
      error in
      TCPListenerIsListening = nil
    }

    // Connecting to listener with TCP mock client
    acceptNewConnectionHandlerInvoked =
      expectation(description: "acceptNewConnectionHandler invoked")

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

    waitForExpectations(timeout: acceptConnectionTimeout) {
      error in
      acceptNewConnectionHandlerInvoked = nil
    }

    clientDisconnectHandlerInvoked = expectation(description: "Client's didDisconnect invoked")

    // When
    tcpListener.stopListeningForConnectionsAndDisconnectClients()
    tcpListener.stopListeningForConnectionsAndDisconnectClients()

    // Then
    waitForExpectations(timeout: disconnectTimeout) {
      error in
      clientDisconnectHandlerInvoked = nil
    }
  }
}

// MARK: - GCDAsyncSocketDelegate
extension TCPListenerTests: GCDAsyncSocketDelegate {

  func socket(_ sock: GCDAsyncSocket, didConnectToHost host: String, port: UInt16) {}
  func socketDidDisconnect(_ sock: GCDAsyncSocket, withError err: NSError?) {}
  func socket(_ sock: GCDAsyncSocket, didWriteDataWithTag tag: Int) {}
  func socketDidCloseReadStream(_ sock: GCDAsyncSocket) {}
}
