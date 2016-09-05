//
//  Thali CordovaPlugin
//  MultiConnectTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license 
//  information.
//

import XCTest
import MultipeerConnectivity
@testable import ThaliCore

class MultiConnectTests: XCTestCase {

    private func createMCPFConnection(advertiserIdentifier: PeerIdentifier, advertiserSessionHandler: (Session) -> Void,
                                      completion: () -> Void) -> (Advertiser, Browser) {
        let serviceType = String.random(length: 7)

        let browser = Browser(serviceType: serviceType, foundPeer: { identifier in
            completion()
            }, lostPeer: { _ in })
        browser.startListening()
        let advertiser = Advertiser(peerIdentifier: advertiserIdentifier,
                                    serviceType: serviceType,
                                    receivedInvitationHandler: advertiserSessionHandler,
                                    disconnectHandler: {})
        advertiser.startAdvertising()

        return (advertiser, browser)
    }

    func testCreateSocket() {
        let foundPeerExpectation = expectationWithDescription("found peer")
        let peerIdentifier = PeerIdentifier()
        var browserStreams, advertiserStreams: (NSOutputStream, NSInputStream)?

        let (advertiser, browser) = createMCPFConnection(peerIdentifier, advertiserSessionHandler: { session in
            let _ = AdvertiserVirtualSocketBuilder(session: session, completionHandler: { socket, error in
                advertiserStreams = socket
                })
        }) { [weak foundPeerExpectation] in
            foundPeerExpectation?.fulfill()
        }
        waitForExpectationsWithTimeout(5, handler: nil)

        do {
            let session = try browser.inviteToConnectPeer(with: peerIdentifier,
                                                          disconnectHandler: {})
            let socketCreatedExpectation = expectationWithDescription("socket created")
            let _ = BrowserVirtualSocketBuilder(session: session,
                                                completionHandler: { [weak socketCreatedExpectation] socket, error in
                                                    browserStreams = socket
                                                    socketCreatedExpectation?.fulfill()
            })
            waitForExpectationsWithTimeout(10, handler: nil)

            XCTAssertNotNil(advertiser)
            XCTAssertNotNil(browserStreams)
            XCTAssertNotNil(advertiserStreams)
        } catch let error {
            XCTAssertNil(error)
        }
    }
}
