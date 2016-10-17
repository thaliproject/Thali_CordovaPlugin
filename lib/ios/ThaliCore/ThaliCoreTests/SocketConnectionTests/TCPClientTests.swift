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
    let noTCPTimeout: NSTimeInterval = -1
    let defaultTCPDataTag = 0
    let acceptConnectionTimeout: NSTimeInterval = 5.0
    let readDataTimeout: NSTimeInterval = 5.0
    let disconnectClientTimeout: NSTimeInterval = 5.0

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
                                       didDisconnect: unexpectedSocketDisconnectHandler)

        var listenerPort: UInt16 = 0
        do {
            listenerPort = try serverMock.startListening()
        } catch {

        }

        XCTAssertNotEqual(listenerPort, 0)

        mockServerAcceptedConnection =
            expectationWithDescription("Mock server accepted connection")

        // When
        // TCP Client is trying to connect to TCP mock server
        let tcpClient = TCPClient(with: unexpectedReadDataHandler,
                                  didDisconnect: unexpectedSocketDisconnectHandler)
        tcpClient.connectToLocalhost(onPort: listenerPort) {
            socket, port, error in
            XCTAssertNil(error)
            XCTAssertEqual(port, listenerPort)
        }

        // Then
        waitForExpectationsWithTimeout(acceptConnectionTimeout) {
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
                                       didDisconnect: unexpectedSocketDisconnectHandler)

        var listenerPort: UInt16 = 0
        do {
            listenerPort = try serverMock.startListening()
        } catch {

        }
        XCTAssertNotEqual(listenerPort, 0)

        mockServerAcceptedConnection =
            expectationWithDescription("Mock server accepted connection")

        // TCP Client is trying to connect to TCP mock server
        let tcpClient = TCPClient(with: {
                                      data in
                                      dataReadHandler?.fulfill()
                                  },
                                  didDisconnect: unexpectedSocketDisconnectHandler)
        tcpClient.connectToLocalhost(onPort: listenerPort) {
            socket, port, error in
            socket!.readDataWithTimeout(self.noTCPTimeout, tag: self.defaultTCPDataTag)
            XCTAssertNil(error)
            XCTAssertEqual(port, listenerPort)
        }

        waitForExpectationsWithTimeout(acceptConnectionTimeout) {
            error in
            mockServerAcceptedConnection = nil
        }

        // When
        // Mock server sends some data to TCP client
        dataReadHandler = expectationWithDescription("dataReadHandler invoked")
        serverMock.sendRandomMessage(length: 100)

        // Then
        waitForExpectationsWithTimeout(readDataTimeout) {
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
        mockServerAcceptedConnection =
            expectationWithDescription("Mock server accepted connection")

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

        waitForExpectationsWithTimeout(acceptConnectionTimeout) {
            error in
            mockServerAcceptedConnection = nil
        }

        // When
        // Mock server disconnects TCP client
        didDisconnectHandler =
            expectationWithDescription("didDisconnectHandler invoked")
        serverMock.disconnectAllClients()

        // Then
        waitForExpectationsWithTimeout(disconnectClientTimeout) {
            error in
            didDisconnectHandler = nil
        }
    }
}
