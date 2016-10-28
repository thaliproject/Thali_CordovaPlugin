//
//  Thali CordovaPlugin
//  MCSessionMock.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import MultipeerConnectivity

class MCSessionMock: MCSession {

  // MARK: - Public state
  var errorOnStartStream = false

  // MARK: - Overrided methods
  override func startStream(withName streamName: String,
                            toPeer peerID: MCPeerID) throws -> OutputStream {
    guard !errorOnStartStream else {
      throw NSError(domain: "org.thaliproject.test", code: 42, userInfo: nil)
    }

    return OutputStream(toBuffer: UnsafeMutablePointer.allocate(capacity: 0), capacity: 0)
  }
}
