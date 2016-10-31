//
//  Thali CordovaPlugin
//  AdvertiserRelayTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import MultipeerConnectivity
@testable import ThaliCore
import XCTest

class AdvertiserRelayTests: XCTestCase {

    // MARK: - State
    var advertiserManager: AdvertiserManager!
    var randomlyGeneratedServiceType: String!
    var randomMessage: String!

    var anyAvailablePort: UInt16 = 0

    let browserFindPeerTimeout: NSTimeInterval = 5.0
    let browserConnectTimeout: NSTimeInterval = 10.0
    let streamReceivedTimeout: NSTimeInterval = 5.0
    let disposeTimeout: NSTimeInterval = 30.0
    let receiveMessageTimeout: NSTimeInterval = 10.0

    // MARK: - Setup & Teardown
    override func setUp() {
        super.setUp()
        randomlyGeneratedServiceType = String.randomValidServiceType(length: 7)

        let crlf = "\r\n"
        let fullMessageLength = 10 * 1024
        let plainMessageLength = fullMessageLength - crlf.characters.count
        randomMessage = String.random(length: plainMessageLength) + crlf

        advertiserManager = AdvertiserManager(serviceType: randomlyGeneratedServiceType,
                                              disposeAdvertiserTimeout: disposeTimeout)
    }

    override func tearDown() {
        randomlyGeneratedServiceType = nil
        randomMessage = nil
        advertiserManager.stopAdvertising()
        advertiserManager = nil
        super.tearDown()
    }

    // MARK: - Tests
    func testMoveDataThrouhgRelayFromBrowserToAdvertiserUsingTCP() {
        // Expectations
        var advertisersNodeServerReceivedMessage: XCTestExpectation?
        var MPCFBrowserFoundAdvertiser: XCTestExpectation?
        var browserManagerConnected: XCTestExpectation?

        // Given
        // Start listening on fake node server
        let advertiserNodeMock = TCPServerMock(didAcceptConnection: { },
                                               didReadData: {
                                                   [weak self] socket, data in
                                                   guard let strongSelf = self else { return }

                                                   let receivedMessage = String(
                                                       data: data,
                                                       encoding: NSUTF8StringEncoding
                                                   )
                                                   XCTAssertEqual(strongSelf.randomMessage,
                                                                  receivedMessage,
                                                                  "Received message is wrong")

                                                   advertisersNodeServerReceivedMessage?.fulfill()
                                               },
                                               didDisconnect: unexpectedSocketDisconnectHandler)
        var advertiserNodeListenerPort: UInt16 = 0
        do {
            advertiserNodeListenerPort = try advertiserNodeMock.startListening(on: anyAvailablePort)
        } catch {
            XCTFail("Can't start listening on fake node server")
        }

        // Prepare pair of advertiser and browser
        MPCFBrowserFoundAdvertiser =
            expectationWithDescription("Browser peer found Advertiser peer")

        // Start advertising on Advertiser's side
        advertiserManager.startUpdateAdvertisingAndListening(onPort: advertiserNodeListenerPort,
                                                             errorHandler: unexpectedErrorHandler)

        // Start listening for advertisements on Browser's side
        let browserManager = BrowserManager(serviceType: randomlyGeneratedServiceType,
                                            inputStreamReceiveTimeout: streamReceivedTimeout,
                                            peersAvailabilityChangedHandler: {
                                                peerAvailability in

                                                guard let peer = peerAvailability.first else {
                                                    XCTFail("Browser didn't find Advertiser peer")
                                                    return
                                                }
                                                XCTAssertTrue(peer.available)
                                                MPCFBrowserFoundAdvertiser?.fulfill()
                                            })
        browserManager.startListeningForAdvertisements(unexpectedErrorHandler)

        waitForExpectationsWithTimeout(browserFindPeerTimeout) {
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
        browserManagerConnected = expectationWithDescription("BrowserManager is connected")

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

        waitForExpectationsWithTimeout(browserConnectTimeout) {
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
                browserManager.activeRelays.value.first,
            let advertiserRelayInfo: (uuid: String, relay: AdvertiserRelay) =
                advertiserManager.activeRelays.value.first
            else {
                return
        }

        guard browserRelayInfo.uuid == advertiserRelayInfo.uuid else {
            XCTFail("MPCF Connection is not valid")
            return
        }

        XCTAssertEqual(advertiserRelayInfo.relay.virtualSocketsAmount,
                       0,
                       "BrowserRelay must not have active virtual sockets")

        // Connect to browser's native TCP listener port
        let browserNodeClientMock = TCPClientMock(didReadData: unexpectedReadDataHandler,
                                                  didConnect: {},
                                                  didDisconnect: unexpectedDisconnectHandler)

        browserNodeClientMock.connectToLocalHost(on: browserNativeTCPListenerPort,
                                                 errorHandler: unexpectedErrorHandler)

        // When
        // Send message from advertiser's node mock server to browser's node mock client
        advertisersNodeServerReceivedMessage =
            expectationWithDescription("Advertiser's fake node server received a message")
        browserNodeClientMock.send(self.randomMessage)

        // Then
        waitForExpectationsWithTimeout(receiveMessageTimeout) {
            error in
            advertisersNodeServerReceivedMessage = nil
        }
    }
}
