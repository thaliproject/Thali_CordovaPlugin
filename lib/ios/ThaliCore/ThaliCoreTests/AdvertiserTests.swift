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

    func testFailedStartAdvertising() {
        let failedStartAdvertisingExpectation =
            expectationWithDescription("failed start advertising")
        let advertiser = Advertiser(peerIdentifier: PeerIdentifier(),
                                    serviceType: String.random(length: 7),
                                    receivedInvitationHandler: { _ in},
                                    disconnectHandler: { })
        advertiser.startAdvertising { [weak failedStartAdvertisingExpectation] error in
            failedStartAdvertisingExpectation?.fulfill()
        }
        let mcAdvertiser = MCNearbyServiceAdvertiser(peer: MCPeerID(displayName: "test"),
                                                     discoveryInfo: nil, serviceType: "test")
        advertiser.advertiser(mcAdvertiser, didNotStartAdvertisingPeer:
            NSError(domain: "org.thaliproject.test", code: 42, userInfo: nil))
        waitForExpectationsWithTimeout(1.0, handler: nil)
    }

}
