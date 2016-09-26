//
//  Thali CordovaPlugin
//  AdvertiserTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import XCTest
@testable import ThaliCore
import MultipeerConnectivity

class AdvertiserTests: XCTestCase {

    // MARK: - Tests
    func testStartStopChangesAdvertisingState() {
        // Given
        let randomlyGeneratedPeerID = MCPeerID(displayName: NSUUID().UUIDString)

        // When
        let advertiser = startAdvertiser(with: randomlyGeneratedPeerID,
                                         receivedInvitationHandler: {
                                            _ in
            },
                                         disconnectHandler: unexpectedDisconnectHandler,
                                         mcInvitationHandler: {
                                            _ in
        })
        // Then
        XCTAssertTrue(advertiser.advertising)

        // When
        advertiser.stopAdvertising()
        // Then
        XCTAssertFalse(advertiser.advertising)
    }

    func testReceivedInvitationHandler() {
        // Given
        let receivedInvitationCalledAfterDelegateCallExpectation =
            expectationWithDescription("receivedInvitation called after delegate call")

        let receivedInvitationHandler: (Session) -> Void = {
            [weak receivedInvitationCalledAfterDelegateCallExpectation] session in
            receivedInvitationCalledAfterDelegateCallExpectation?.fulfill()
        }

        let randomlyGeneratedPeerID = MCPeerID(displayName: NSUUID().UUIDString)

        // When
        let _ = startAdvertiser(with: randomlyGeneratedPeerID,
                                receivedInvitationHandler: receivedInvitationHandler,
                                disconnectHandler: unexpectedDisconnectHandler,
                                mcInvitationHandler: { _ in })

        // Then
        let receivedInvitationTimeout = 1.0
        waitForExpectationsWithTimeout(receivedInvitationTimeout, handler: nil)
    }

    func testDisconnectHandlerCalled() {
        // Given
        let disconnectCalledExpectation =
            expectationWithDescription("disconnect called session disconnected")

        var mcSession: MCSession?
        let randomlyGeneratedPeerID = MCPeerID(displayName: NSUUID().UUIDString)

        // When
        let _ = startAdvertiser(with: randomlyGeneratedPeerID,
                                receivedInvitationHandler: {
                                    session in

                                    guard let mcSession = mcSession else {
                                        return
                                    }

                                    // Fake invocation of delegate method
                                    session.session(mcSession,
                                        peer: randomlyGeneratedPeerID,
                                        didChangeState: .NotConnected)
            },
                                disconnectHandler: {
                                    [weak disconnectCalledExpectation] in
                                    disconnectCalledExpectation?.fulfill()
            },
                                mcInvitationHandler: {
                                    result, session in
                                    mcSession = session
        })

        // Then
        let sessionDisconnectedTimeout = 1.0
        waitForExpectationsWithTimeout(sessionDisconnectedTimeout, handler: nil)
    }

    func testFailedStartAdvertising() {
        // Given
        let startAdvertisingErrorHandlerCalled =
            expectationWithDescription("startAdvertisingErrorHandler was called")

        let advertiser = Advertiser(peerIdentifier: PeerIdentifier(),
                                    serviceType: String.random(length: 7),
                                    receivedInvitationHandler: unexpectedSessionHandler,
                                    disconnectHandler: unexpectedDisconnectHandler)

        advertiser.startAdvertising {
            [weak startAdvertisingErrorHandlerCalled] error in
            startAdvertisingErrorHandlerCalled?.fulfill()
        }

        let mcAdvertiser = MCNearbyServiceAdvertiser(peer: MCPeerID(displayName: "test"),
                                                     discoveryInfo: nil,
                                                     serviceType: "test")

        // When
        // Fake invocation of delegate method
        let error = NSError(domain: "org.thaliproject.test", code: 42, userInfo: nil)
        advertiser.advertiser(mcAdvertiser, didNotStartAdvertisingPeer: error)

        // Then
        let failedStartAdvertisingTimeout = 1.0
        waitForExpectationsWithTimeout(failedStartAdvertisingTimeout, handler: nil)
    }

    // MARK: - Private methods
    private func startAdvertiser(with peerID: MCPeerID,
                                      receivedInvitationHandler: (Session) -> Void,
                                      disconnectHandler: () -> Void,
                                      mcInvitationHandler: (Bool, MCSession) -> Void) -> Advertiser {

        let randomlyGeneratedServiceType = String.random(length: 7)

        let advertiser = Advertiser(peerIdentifier: PeerIdentifier(),
                                    serviceType: randomlyGeneratedServiceType,
                                    receivedInvitationHandler:receivedInvitationHandler,
                                    disconnectHandler: disconnectHandler)

        let advertiserPeerID = MCPeerID(displayName: NSUUID().UUIDString)
        let mcAdvertiser = MCNearbyServiceAdvertiser(peer: advertiserPeerID,
                                                     discoveryInfo: nil,
                                                     serviceType: randomlyGeneratedServiceType)

        // Fake invocation of delegate method
        advertiser.advertiser(mcAdvertiser,
                              didReceiveInvitationFromPeer: peerID,
                              withContext: nil,
                              invitationHandler: mcInvitationHandler)
        advertiser.startAdvertising(unexpectedErrorHandler)
        return advertiser
    }
}
