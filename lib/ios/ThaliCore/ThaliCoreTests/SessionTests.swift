//
//  Thali CordovaPlugin
//  SessionTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import XCTest
@testable import ThaliCore
import MultipeerConnectivity

class SessionTests: XCTestCase {
    var disconnectedExpectation: XCTestExpectation!
    var mcSession: MCSession!
    var peerID: MCPeerID!
    var session: Session!

    override func setUp() {
        disconnectedExpectation = expectationWithDescription("disconnected")
        mcSession = MCSession(peer: MCPeerID(displayName: String.random(length: 5)))
        peerID = MCPeerID(displayName: String.random(length: 5))
        session = Session(session: mcSession, identifier: peerID) {
            [weak disconnectedExpectation] in
            disconnectedExpectation?.fulfill()
        }
    }

    func testSessionDisconnected() {
        mcSession.delegate?.session(mcSession, peer: peerID, didChangeState: .NotConnected)
        waitForExpectationsWithTimeout(2, handler: nil)
    }
}
