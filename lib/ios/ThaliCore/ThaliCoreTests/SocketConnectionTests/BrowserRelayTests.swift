//
//  Thali CordovaPlugin
//  BrowserRelayTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import MultipeerConnectivity
@testable import ThaliCore
import XCTest

class BrowserRelayTests: XCTestCase {

  // MARK: - State
  var mcPeerID: MCPeerID!
  var mcSessionMock: MCSessionMock!
  var nonTCPSession: Session!

  var randomlyGeneratedServiceType: String!
  var randomMessage: String!
  let anyAvailalbePort: UInt16 = 0

  let browserFindPeerTimeout: TimeInterval = 5.0
  let browserConnectTimeout: TimeInterval = 5.0
  let streamReceivedTimeout: TimeInterval = 5.0
  let clientConnectTimeout: TimeInterval = 5.0
  let clientDisconnectTimeout: TimeInterval = 5.0
  let openRelayTimeout: TimeInterval = 5.0
  let disposeTimeout: TimeInterval = 30.0
  let receiveMessageTimeout: TimeInterval = 5.0

  // MARK: - Setup & Teardown
  override func setUp() {
    super.setUp()
    randomlyGeneratedServiceType = String.randomValidServiceType(length: 7)
    randomMessage = String.random(length: 100)

    mcPeerID = MCPeerID(displayName: String.random(length: 5))
    mcSessionMock = MCSessionMock(peer: MCPeerID(displayName: String.random(length: 5)))
    nonTCPSession = Session(session: mcSessionMock,
                            identifier: mcPeerID,
                            connected: {},
                            notConnected: {})
  }

  override func tearDown() {
    randomlyGeneratedServiceType = nil
    randomMessage = nil
    mcPeerID = nil
    mcSessionMock = nil
    nonTCPSession = nil
    super.tearDown()
  }

  // MARK: - Tests
  func testOpenRelayMethodReturnsTCPListenerPort() {
    // Expectations
    var TCPPortIsReturned: XCTestExpectation?

    // Given
    let relay = BrowserRelay(with: nonTCPSession,
                             createVirtualSocketTimeout: streamReceivedTimeout)

    // When
    TCPPortIsReturned = expectation(description: "TCP port is returned")
    relay.openRelay {
      port, error in
      XCTAssertNil(error, "Error during opening relay")
      XCTAssertNotNil(port, "Listener port should not be nil")
      TCPPortIsReturned?.fulfill()
    }

    // Then
    waitForExpectations(timeout: openRelayTimeout) {
      error in
      TCPPortIsReturned = nil
    }
  }

  func testClientCanConnectToPortReturnedByRelay() {
    // Expectations
    var TCPPortIsReturned: XCTestExpectation?
    var сlientConnectedToListenerPort: XCTestExpectation?

    // Given
    // Open
    TCPPortIsReturned = expectation(description: "TCP port is returned")
    var listenerPort: UInt16 = 0
    let relay = BrowserRelay(with: nonTCPSession, createVirtualSocketTimeout: streamReceivedTimeout)

    relay.openRelay {
      port, error in
      XCTAssertNil(error)

      guard let port = port else {
        XCTFail("Listener port should not be nil")
        return
      }

      listenerPort = port
      TCPPortIsReturned?.fulfill()
    }

    waitForExpectations(timeout: streamReceivedTimeout) {
      error in
      TCPPortIsReturned = nil
    }

    // When
    // Mock client trying to connect to the port returned by Relay
    сlientConnectedToListenerPort =
      expectation(description: "Mock client is connected to listener port")
    let clientMock = TCPClientMock(didReadData: unexpectedReadDataHandler,
                                   didConnect: {
                                     сlientConnectedToListenerPort?.fulfill()
                                   },
                                   didDisconnect: unexpectedDisconnectHandler)
    clientMock.connectToLocalHost(on: listenerPort, errorHandler: unexpectedErrorHandler)

    // Then
    waitForExpectations(timeout: clientConnectTimeout) {
      error in
      сlientConnectedToListenerPort = nil
    }
  }

  func testCloseRelayMethodOnBrowserClosesTCPListenerPort() {
    // Expectations
    var TCPPortIsReturned: XCTestExpectation?
    var clientCantConnectToListener: XCTestExpectation?

    // Given
    // Open relay and get listener port
    TCPPortIsReturned = expectation(description: "TCP port is returned")

    var listenerPort: UInt16 = 0
    let relay = BrowserRelay(with: nonTCPSession,
                             createVirtualSocketTimeout: streamReceivedTimeout)
    relay.openRelay {
      port, error in
      XCTAssertNil(error)

      guard let port = port else {
        XCTFail("Listener port should not be nil")
        return
      }

      listenerPort = port
      TCPPortIsReturned?.fulfill()
    }

    waitForExpectations(timeout: openRelayTimeout) {
      error in
      TCPPortIsReturned = nil
    }

    // When
    // Close relay and trying to connect to the listener port
    clientCantConnectToListener =
      expectation(description: "Mock client can't connect to listener port")
    relay.closeRelay()

    let clientMock = TCPClientMock(didReadData: unexpectedReadDataHandler,
                                   didConnect: unexpectedConnectHandler,
                                   didDisconnect: {
                                     clientCantConnectToListener?.fulfill()
                                   })

    clientMock.connectToLocalHost(on: listenerPort, errorHandler: unexpectedErrorHandler)

    // Then
    waitForExpectations(timeout: clientDisconnectTimeout) {
      error in
      clientCantConnectToListener = nil
    }
  }

  func testMoveDataThrouhgRelayFromAdvertiserToBrowserUsingTCP() {
    // Expectations
    var browserNodeClientReceivedMessage: XCTestExpectation?
    var MPCFBrowserFoundAdvertiser: XCTestExpectation?
    var browserManagerConnected: XCTestExpectation?

    // Given
    // Start listening on fake node server (Advertiser's side)
    let advertiserNodeMock = TCPServerMock(didAcceptConnection: { },
                                           didReadData: { _ in},
                                           didDisconnect: unexpectedSocketDisconnectHandler)
    var advertiserNodeListenerPort: UInt16 = 0
    do {
      advertiserNodeListenerPort = try advertiserNodeMock.startListening(on: anyAvailalbePort)
    } catch {
      XCTFail("Can't start listening on fake node server")
    }

    // Prepare pair of advertiser and browser
    MPCFBrowserFoundAdvertiser =
      expectation(description: "Browser peer found Advertiser peer")

    // Start listening for advertisements on Browser's side
    let browserManager = BrowserManager(serviceType: randomlyGeneratedServiceType,
                                        inputStreamReceiveTimeout: streamReceivedTimeout,
                                        peerAvailabilityChanged: {
                                          peerAvailability in

                                          guard let peer = peerAvailability.first else {
                                            XCTFail("Browser didn't find Advertiser peer")
                                            return
                                          }
                                          XCTAssertTrue(peer.available)
                                          MPCFBrowserFoundAdvertiser?.fulfill()
                                        })
    browserManager.startListeningForAdvertisements(unexpectedErrorHandler)

    // Start advertising on Advertiser's side
    let advertiserManager = AdvertiserManager(serviceType: randomlyGeneratedServiceType,
                                              disposeAdvertiserTimeout: disposeTimeout)
    advertiserManager.startUpdateAdvertisingAndListening(onPort: advertiserNodeListenerPort,
                                                         errorHandler: unexpectedErrorHandler)

    waitForExpectations(timeout: browserFindPeerTimeout) {
      error in
      MPCFBrowserFoundAdvertiser = nil
    }

    // Create MCsession between browser and adveriser
    // Then get TCP listener port from browser manager
    guard let peerToConnect = browserManager.availablePeers.value.first else {
      XCTFail("BrowserManager does not have available peers to connect")
      return        }

    // Connect method invocation
    browserManagerConnected =
      expectation(description: "BrowserManager is connected")

    var browserNativeTCPListenerPort: UInt16 = 0
    browserManager.connectToPeer(peerToConnect.uuid, syncValue: "0") {
      syncValue, error, port in

      guard let port = port else {
        XCTFail("Port must not be nil")
        return
      }

      browserNativeTCPListenerPort = port
      browserManagerConnected?.fulfill()
    }

    waitForExpectations(timeout: browserConnectTimeout) {
      error in
      guard error == nil else {
        XCTFail("Browser could not connect to peer")
        return
      }
      browserManager.stopListeningForAdvertisements()
      browserManagerConnected = nil
    }

    // Check if relay objectes are valid
    guard
      let browserRelayInfo: (uuid: String, relay: BrowserRelay) =
      browserManager.activeRelays.value.first as? (uuid: String, relay: BrowserRelay),
      let advertiserRelayInfo: (uuid: String, relay: AdvertiserRelay) =
      advertiserManager.activeRelays.value.first as? (uuid: String, relay: AdvertiserRelay)
      else {
        return
    }

    guard browserRelayInfo.uuid == advertiserRelayInfo.uuid else {
      XCTFail("MPCF Connection is not valid")
      return
    }

    XCTAssertEqual(browserRelayInfo.relay.virtualSocketsAmount,
                   0,
                   "BrowserRelay must not have active virtual sockets")

    // Connect to browser's native TCP listener port
    let browserNodeClientMock = TCPClientMock(didReadData: {
                                                [weak self] data in
                                                guard let strongSelf = self else { return }

                                                let receivedMessage = String(
                                                  data: data,
                                                  encoding: String.Encoding.utf8
                                                )

                                                XCTAssertEqual(strongSelf.randomMessage,
                                                               receivedMessage,
                                                               "Received message is wrong")

                                                browserNodeClientReceivedMessage?.fulfill()
                                              },
                                              didConnect: {},
                                              didDisconnect: unexpectedDisconnectHandler)

    browserNodeClientMock.connectToLocalHost(on: browserNativeTCPListenerPort,
                                             errorHandler: unexpectedErrorHandler)

    // When
    // Send message from advertiser's node mock server to browser's node mock client
    browserNodeClientReceivedMessage =
      expectation(description: "Browser's mock node client received a message")
    advertiserNodeMock.send(self.randomMessage)

    // Then
    waitForExpectations(timeout: receiveMessageTimeout) {
      error in
      browserNodeClientReceivedMessage = nil
    }

    // Cleanup
    advertiserManager.stopAdvertising()
  }
}
