//
//  Thali CordovaPlugin
//  BrowserTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import XCTest
@testable import ThaliCore
import MultipeerConnectivity

class BrowserTests: XCTestCase {

    let serviceType = String.random(length: 7)

    private func unexpectedFoundPeerHandler(peer: PeerIdentifier) {
        XCTFail("unexpected find peer event with peer: \(peer)")
    }

    private func unexpectedLostPeerHandler(peer: PeerIdentifier) {
        XCTFail("unexpected lost peer event with peer: \(peer)")
    }

    func testReceivedFailedStartBrowsingErrorOnMPCFBrowserDelegateCall() {
        // Preconditions
        let failedStartBrowsingExpectation =
            expectationWithDescription("failed start advertising because of delegate " +
                                       "MCNearbyServiceBrowserDelegate call")
        let browser = Browser(serviceType: serviceType,
                              foundPeer: unexpectedFoundPeerHandler,
                              lostPeer: unexpectedLostPeerHandler)
        browser.startListening { [weak failedStartBrowsingExpectation] error in
            failedStartBrowsingExpectation?.fulfill()
        }

        // Send error start browsing failed error
        let peerID = MCPeerID(displayName: NSUUID().UUIDString)
        let mcBrowser = MCNearbyServiceBrowser(peer: peerID, serviceType: serviceType)
        let error = NSError(domain: "org.thaliproject.test", code: 42, userInfo: nil)
        browser.browser(mcBrowser, didNotStartBrowsingForPeers: error)

        waitForExpectationsWithTimeout(1.0, handler: nil)
    }

    func testStartStopChangesListeningState() {
        let browser = Browser(serviceType: serviceType,
                              foundPeer: unexpectedFoundPeerHandler,
                              lostPeer: unexpectedLostPeerHandler)
        browser.startListening(unexpectedErrorHandler)
        XCTAssertTrue(browser.listening)
        browser.stopListening()
        XCTAssertFalse(browser.listening)
    }

    func testFoundLostPeerCalled() {
        let foundPeerExpectation = expectationWithDescription("found peer expectation")
        let lostPeerExpectation = expectationWithDescription("lost peer expectation")
        let browser  = Browser(serviceType: serviceType,
                               foundPeer: { [weak foundPeerExpectation] _ in
                                   foundPeerExpectation?.fulfill()
                               },
                               lostPeer: { [weak lostPeerExpectation] _ in
                                   lostPeerExpectation?.fulfill()
                               })
        let peerID = MCPeerID(displayName: PeerIdentifier().stringValue)
        let mcBrowser = MCNearbyServiceBrowser(peer: peerID, serviceType: serviceType)


        browser.browser(mcBrowser, foundPeer: peerID, withDiscoveryInfo: nil)
        browser.browser(mcBrowser, lostPeer: peerID)

        let foundLostPeerExpectationsTimeout = 1.0
        waitForExpectationsWithTimeout(foundLostPeerExpectationsTimeout, handler: nil)
    }

    func testInviteToConnectWithPeerReturnsSession() {
        let foundPeerExpectation = expectationWithDescription("found peer expectation")
        let peerIdentifier = PeerIdentifier()

        let browser = Browser(serviceType: serviceType,
                              foundPeer: { [weak foundPeerExpectation] peer in
                                  foundPeerExpectation?.fulfill()
                                  XCTAssertEqual(peer, peerIdentifier)
                              },
                              lostPeer: unexpectedLostPeerHandler)

        let peerID = MCPeerID(displayName: peerIdentifier.stringValue)
        let mcBrowser = MCNearbyServiceBrowser(peer: peerID, serviceType: serviceType)
        browser.browser(mcBrowser, foundPeer: peerID, withDiscoveryInfo: nil)
        let foundPeerExpectationTimeout = 1.0
        waitForExpectationsWithTimeout(foundPeerExpectationTimeout, handler: nil)

        do {
            let _ =
                try browser.inviteToConnectPeer(with: peerIdentifier,
                                                disconnectHandler: unexpectedDisconnectHandler)
        } catch let error {
            XCTFail("unexpected error: \(error)")
        }
    }

    func testInviteToConnectWrongPeerIdError() {
        let browser = Browser(serviceType: serviceType,
                              foundPeer: unexpectedFoundPeerHandler,
                              lostPeer: unexpectedLostPeerHandler)
        do {
            let _ =
                try browser.inviteToConnectPeer(with: PeerIdentifier(),
                                                disconnectHandler: unexpectedDisconnectHandler)
        } catch let error as MultiConnectError {
            XCTAssertEqual(error, MultiConnectError.IllegalPeerID)
        } catch let error {
            XCTFail("unexpected error: \(error)")
        }
    }

}
