//
//  Thali CordovaPlugin
//  SocketRelayTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license
//  information.
//

import XCTest
@testable import ThaliCore
import MultipeerConnectivity

class SocketRelayTests: XCTestCase {

    func testSocketCreateTimeout() {
        let timeout: Double = 1.0
        let relay = SocketRelay<BrowserVirtualSocketBuilder>(createSocketTimeout: timeout)
        let peerID = MCPeerID(displayName: "test")
        let mcSession = MCSession(peer: peerID)
        let session = Session(session: mcSession, identifier: peerID) { _ in }
        let expectation = expectationWithDescription("got connection timed out")
        var error: MultiConnectError?
        relay.createSocket(with: session) { port, err in
            error = err as? MultiConnectError
            expectation.fulfill()
        }
        waitForExpectationsWithTimeout(timeout + 1, handler: nil)
        XCTAssertEqual(error, .ConnectionTimedOut)
    }
}
