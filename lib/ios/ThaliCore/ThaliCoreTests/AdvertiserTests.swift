//
//  Thali CordovaPlugin
//  AdvertiserTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license
//  information.
//

import XCTest
@testable import ThaliCore
import MultipeerConnectivity

class AdvertiserTests: XCTestCase {

    private func startAdvertiser(with peerID: MCPeerID,
                                 receivedInvitationHandler: (Session) -> Void,
                                 disconnectHandler: () -> Void,
                                 mcInvitationHandler: (Bool, MCSession) -> Void) -> Advertiser {
        let serviceType = String.random(length: 7)
        let advertiser = Advertiser(peerIdentifier: PeerIdentifier(),
                serviceType: serviceType,
                receivedInvitationHandler:receivedInvitationHandler,
                disconnectHandler: disconnectHandler)

        let advertiserPeerID = MCPeerID(displayName: NSUUID().UUIDString)
        let mcAdvertiser = MCNearbyServiceAdvertiser(peer: advertiserPeerID,
                discoveryInfo: nil, serviceType: serviceType)
        advertiser.advertiser(mcAdvertiser, didReceiveInvitationFromPeer: peerID,
                withContext: nil,
                invitationHandler: mcInvitationHandler)
        advertiser.startAdvertising(unexpectedErrorHandler)
        return advertiser
    }

    func testFailedStartAdvertising() {
        let failedStartAdvertisingExpectation =
            expectationWithDescription("failed start advertising")
        let advertiser = Advertiser(peerIdentifier: PeerIdentifier(),
                                    serviceType: String.random(length: 7),
                                    receivedInvitationHandler: unexpectedSessionHandler,
                                    disconnectHandler: unexpectedDisconnectHandler)
        advertiser.startAdvertising { [weak failedStartAdvertisingExpectation] error in
            failedStartAdvertisingExpectation?.fulfill()
        }
        let mcAdvertiser = MCNearbyServiceAdvertiser(peer: MCPeerID(displayName: "test"),
                                                     discoveryInfo: nil, serviceType: "test")
        advertiser.advertiser(mcAdvertiser, didNotStartAdvertisingPeer:
            NSError(domain: "org.thaliproject.test", code: 42, userInfo: nil))

        let failedStartAdvertisingTimeout = 1.0
        waitForExpectationsWithTimeout(failedStartAdvertisingTimeout, handler: nil)
    }

    func testReceivedInvitationHandler() {
        let receivedInvitationCalledAfterDelegateCallExpectation =
            expectationWithDescription("receivedInvitation called after delegate call")
        let receivedInvitationHandler: (Session) -> Void = {
            [weak receivedInvitationCalledAfterDelegateCallExpectation] session in
            receivedInvitationCalledAfterDelegateCallExpectation?.fulfill()
        }
        let peerID = MCPeerID(displayName: NSUUID().UUIDString)
        let _ = startAdvertiser(with: peerID,  receivedInvitationHandler: receivedInvitationHandler,
                                disconnectHandler: unexpectedDisconnectHandler,
                                mcInvitationHandler: { _ in })

        let receivedInvitationTimeout = 1.0
        waitForExpectationsWithTimeout(receivedInvitationTimeout, handler: nil)
    }

    func testDisconnectHandlerCalled() {
        let disconnectCalledExpectation =
            expectationWithDescription("disconnect called session disconnected")
        var mcSession: MCSession?
        let peerID: MCPeerID = MCPeerID(displayName: NSUUID().UUIDString)

        let disconnectHandler = { [weak disconnectCalledExpectation] in
            disconnectCalledExpectation?.fulfill()
            return
        }
        let receivedInvitationHandler: (Session) -> Void = { session in
            guard let mcSession = mcSession else {
                return
            }
            session.session(mcSession, peer: peerID, didChangeState: .NotConnected)
        }
        let _ = startAdvertiser(with: peerID, receivedInvitationHandler: receivedInvitationHandler,
                                               disconnectHandler: disconnectHandler,
                                               mcInvitationHandler: { result, session in
                mcSession = session
        })

        let sessionDisconnectedTimeout = 1.0
        waitForExpectationsWithTimeout(sessionDisconnectedTimeout, handler: nil)
    }

    func testStartStopChangesAdvertisingState() {
        let peerID: MCPeerID = MCPeerID(displayName: NSUUID().UUIDString)
        let advertiser = startAdvertiser(with: peerID,
                                          receivedInvitationHandler: unexpectedSessionHandler,
                                          disconnectHandler: unexpectedDisconnectHandler,
                                          mcInvitationHandler: { _ in })

        XCTAssertTrue(advertiser.advertising)
        advertiser.stopAdvertising()
        XCTAssertFalse(advertiser.advertising)
    }
}
