//
//  Thali CordovaPlugin
//  RelayTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import MultipeerConnectivity
@testable import ThaliCore
import XCTest

class RelayTests: XCTestCase {

  // MARK: - State
  var mcPeerID: MCPeerID!
  var mcSessionMock: MCSessionMock!
  var nonTCPSession: Session!
  var randomGeneratedServiceType: String!
  var randomMessage: String!

  let anyAvailablePort: UInt16 = 0

  let streamReceivedTimeout: TimeInterval = 5.0
  let openRelayTimeout: TimeInterval = 10.0
  let clientConnectTimeout: TimeInterval = 5.0
  let clientDisconnectTimeout: TimeInterval = 10.0
  let disposeTimeout: TimeInterval = 30.0
  let newConnectionTimeout: TimeInterval = 10.0
  let browserFindPeerTimeout: TimeInterval = 5.0
  let browserConnectTimeout = 5.0
  let moveDataTimeout = 15.0

  // MARK: - Setup & Teardown
  override func setUp() {
    super.setUp()
    randomGeneratedServiceType = String.randomValidServiceType(length: 7)
    mcPeerID = MCPeerID(displayName: String.random(length: 5))
    mcSessionMock = MCSessionMock(peer: MCPeerID(displayName: String.random(length: 5)))
    nonTCPSession = Session(session: mcSessionMock,
                            identifier: mcPeerID,
                            connected: {},
                            notConnected: {})

    let crlf = "\r\n"
    let fullMessageLength = 1 * 1024
    let plainMessageLength = fullMessageLength - crlf.characters.count
    randomMessage = String.random(length: plainMessageLength) + crlf

  }

  override func tearDown() {
    randomGeneratedServiceType = nil
    mcPeerID = nil
    mcSessionMock = nil
    nonTCPSession = nil
    randomMessage = nil
    super.tearDown()
  }

  // MARK: Tests
  func testOpenTenVirtualSocketsAndMoveData() {
    // Expectations
    var MPCFBrowserFoundAdvertiser: XCTestExpectation?
    var advertisersNodeServerReceivedMessage: XCTestExpectation?
    var browserManagerConnected: XCTestExpectation?

    // Given
    let totalMessagesNumber = 10
    let receivedMessagesNumber = Atomic(0)

    // Start listening on fake node server
    let advertiserNodeMock =
      TCPServerMock(didAcceptConnection: { },
                    didReadData: {
                      [weak self] socket, data in
                      guard let strongSelf = self else { return }

                      let receivedMessage = String(data: data, encoding: String.Encoding.utf8)
                      XCTAssertEqual(strongSelf.randomMessage,
                                     receivedMessage,
                                     "Received message is wrong")

                      receivedMessagesNumber.modify {
                        $0 += 1
                        if $0 == totalMessagesNumber {
                          advertisersNodeServerReceivedMessage?.fulfill()
                        }
                      }
                    },
                    didDisconnect: { _ in })

    var advertiserNodeListenerPort: UInt16 = 0
    do {
      advertiserNodeListenerPort = try advertiserNodeMock.startListening(on: anyAvailablePort)
    } catch {
      XCTFail("Can't start listening on fake node server")
    }

    // Prepare pair of advertiser and browser
    MPCFBrowserFoundAdvertiser = expectation(description: "Browser peer found Advertiser peer")

    // Start listening for advertisements on browser
    let browserManager = BrowserManager(serviceType: randomGeneratedServiceType,
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

    // Start advertising on advertiser
    let advertiserManager = AdvertiserManager(serviceType: randomGeneratedServiceType,
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
      return
    }

    // Connect method invocation
    browserManagerConnected = expectation(description: "BrowserManager is connected")

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

    // Creating a bunch of clients, then each of them will send a message
    var browserClients: [TCPClientMock] = []
    for _ in 0..<totalMessagesNumber {
      let browserNodeClientMock = TCPClientMock(didReadData: unexpectedReadDataHandler,
                                                didConnect: {},
                                                didDisconnect: {})

      browserClients.append(browserNodeClientMock)
    }

    // Connect to browser's native TCP listener port
    for i in 0..<totalMessagesNumber {
      let browserClient = browserClients[i]
      browserClient.connectToLocalHost(on: browserNativeTCPListenerPort,
                                       errorHandler: unexpectedErrorHandler)

      browserClient.send(randomMessage)
    }

    advertisersNodeServerReceivedMessage =
      expectation(description: "Advertiser's fake node server received a message")

    waitForExpectations(timeout: moveDataTimeout) {
      error in
      advertisersNodeServerReceivedMessage = nil
    }

    advertiserManager.stopAdvertising()
  }
}
