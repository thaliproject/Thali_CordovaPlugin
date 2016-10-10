//
//  Thali CordovaPlugin
//  VirtualSocketTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import MultipeerConnectivity
@testable import ThaliCore
import XCTest

class VirtualSocketTests: XCTestCase {

    // MARK: - State
    var mcPeerID: MCPeerID!
    var mcSessionMock: MCSessionMock!
    var streamReceivedTimeout: NSTimeInterval!
    var nonTCPSession: Session!

    // MARK: - Setup
    // TODO: check all marks in tests and code
    override func setUp() {
        mcPeerID = MCPeerID(displayName: String.random(length: 5))
        mcSessionMock = MCSessionMock(peer: MCPeerID(displayName: String.random(length: 5)))
        streamReceivedTimeout = 5.0
        nonTCPSession = Session(session: mcSessionMock,
                                identifier: mcPeerID,
                                connected: {},
                                notConnected: {})
    }
}
