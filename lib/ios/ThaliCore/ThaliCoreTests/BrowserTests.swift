//
//  Thali CordovaPlugin
//  BrowserTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license
//  information.
//

import XCTest
@testable import ThaliCore
import MultipeerConnectivity

class BrowserTests: XCTestCase {

    func testFailedStartBrowsing() {
        let failedStartBrowsingExpectation =
            expectationWithDescription("failed start advertising")
        let browser = Browser(serviceType: "test",
                              foundPeer: { _ in },
                              lostPeer: { _ in })

        browser.startListening { [weak failedStartBrowsingExpectation] error in
            failedStartBrowsingExpectation?.fulfill()
        }
        let mcBrowser = MCNearbyServiceBrowser(peer: MCPeerID(displayName: "test"),
                                               serviceType: "test")
        browser.browser(mcBrowser, didNotStartBrowsingForPeers:
            NSError(domain: "org.thaliproject.test", code: 42, userInfo: nil))
        waitForExpectationsWithTimeout(1.0, handler: nil)
    }
}
