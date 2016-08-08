//
//  Thali CordovaPlugin
//  SessionManager.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//
import Foundation
import MultipeerConnectivity

///Opening TCP/IP listener and bind it to input and output streams
class SessionManager {
    let session: MCSession

    init(peer: MCPeerID) {
        session = MCSession(peer: peer, securityIdentity: nil, encryptionPreference: .None)
    }

    func connectToPort(port: UInt16) {

    }

}
