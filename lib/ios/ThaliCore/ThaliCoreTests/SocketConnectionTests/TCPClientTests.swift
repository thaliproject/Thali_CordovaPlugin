//
//  Thali CordovaPlugin
//  TCPClientTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

@testable import ThaliCore
import XCTest

class TCPClientTests: XCTestCase {

  // MARK: - State
  let noTCPTimeout: TimeInterval = -1
  let defaultTCPDataTag = 0
  let acceptConnectionTimeout: TimeInterval = 5.0
  let readDataTimeout: TimeInterval = 5.0
  let disconnectClientTimeout: TimeInterval = 5.0

  // MARK: - Tests
  func testTCPClientCanConnectToServerAndReturnsListenerPort() {
    // Expectations
    var mockServerAcceptedConnection: XCTestExpectation?

    // Given
    // Mock server that listening for incoming TCP connecitons
    let serverMock = TCPServerMock(didAcceptConnection: {
                                     mockServerAcceptedConnection?.fulfill()
                                   },
                                   didReadData: unexpectedReadDataHandler,
                                   didDisconnect: { _ in })

    var listenerPort: UInt16 = 0
    do {
      listenerPort = try serverMock.startListening()
    } catch {
    }

    XCTAssertNotEqual(listenerPort, 0)

    mockServerAcceptedConnection = expectation(description: "Mock server accepted connection")

    // When
    // TCP Client is trying to connect to TCP mock server
    let tcpClient = TCPClient(with: unexpectedReadDataHandler,
                              didDisconnect: { _ in })
    tcpClient.connectToLocalhost(onPort: listenerPort) {
      socket, port, error in
      XCTAssertNil(error)
      XCTAssertEqual(port, listenerPort)
    }

    // Then
    waitForExpectations(timeout: acceptConnectionTimeout) {
      error in
      mockServerAcceptedConnection = nil
    }
  }

  func testReadDataHandlerInvokedWhenTCPClientGetsData() {
    // Expectations
    var mockServerAcceptedConnection: XCTestExpectation?
    var dataReadHandler: XCTestExpectation?

    // Given
    // Mock server that listening for incoming TCP connecitons
    let serverMock = TCPServerMock(didAcceptConnection: {
                                     mockServerAcceptedConnection?.fulfill()
                                   },
                                   didReadData: { _ in },
                                   didDisconnect: { _ in })

    var listenerPort: UInt16 = 0
    do {
      listenerPort = try serverMock.startListening()
    } catch {

    }
    XCTAssertNotEqual(listenerPort, 0)

    mockServerAcceptedConnection = expectation(description: "Mock server accepted connection")

    // TCP Client is trying to connect to TCP mock server
    let tcpClient = TCPClient(with: {
                                data in
                                dataReadHandler?.fulfill()
                              },
                              didDisconnect: { _ in })
    tcpClient.connectToLocalhost(onPort: listenerPort) {
      socket, port, error in
      socket!.readData(withTimeout: self.noTCPTimeout, tag: self.defaultTCPDataTag)
      XCTAssertNil(error)
      XCTAssertEqual(port, listenerPort)
    }

    waitForExpectations(timeout: acceptConnectionTimeout) {
      error in
      mockServerAcceptedConnection = nil
    }

    // When
    // Mock server sends some data to TCP client
    dataReadHandler = expectation(description: "dataReadHandler invoked")
    serverMock.sendRandomMessage(length: 100)

    // Then
    waitForExpectations(timeout: readDataTimeout) {
      error in
      dataReadHandler = nil
    }
  }

  func testDisconnectHandlerInvokedWhenServerDisconnects() {
    // Expectations
    var mockServerAcceptedConnection: XCTestExpectation?
    var didDisconnectHandler: XCTestExpectation?

    // Given
    // Mock server that listening for incoming TCP connecitons
    let serverMock = TCPServerMock(didAcceptConnection: {
                                     mockServerAcceptedConnection?.fulfill()
                                   },
                                   didReadData: unexpectedReadDataHandler,
                                   didDisconnect: { _ in })

    var listenerPort: UInt16 = 0
    do {
      listenerPort = try serverMock.startListening()
    } catch {
    }

    // TCP Client is trying to connect to TCP mock server
    mockServerAcceptedConnection = expectation(description: "Mock server accepted connection")

    let tcpClient = TCPClient(with: unexpectedReadDataHandler,
                              didDisconnect: {
                                socket in
                                didDisconnectHandler?.fulfill()
                              })
    tcpClient.connectToLocalhost(onPort: listenerPort) {
      socket, port, error in
      XCTAssertNil(error)
      XCTAssertEqual(port, listenerPort)
    }

    waitForExpectations(timeout: acceptConnectionTimeout) {
      error in
      mockServerAcceptedConnection = nil
    }

    // When
    // Mock server disconnects TCP client
    didDisconnectHandler = expectation(description: "didDisconnectHandler invoked")
    serverMock.disconnectAllClients()

    // Then
    waitForExpectations(timeout: disconnectClientTimeout) {
      error in
      didDisconnectHandler = nil
    }
  }
}
