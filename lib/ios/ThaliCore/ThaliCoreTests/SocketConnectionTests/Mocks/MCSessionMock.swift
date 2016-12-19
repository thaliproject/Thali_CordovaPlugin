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
  override func startStreamWithName(streamName: String,
                                    toPeer peerID: MCPeerID) throws
                                    -> NSOutputStream {
    guard !errorOnStartStream else {
      throw NSError(domain: "org.thaliproject.test", code: 42, userInfo: nil)
    }

    return NSOutputStream(toBuffer: nil, capacity: 0)
  }
}
