//
//  Thali CordovaPlugin
//  Session.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import MultipeerConnectivity

/**
 Manages underlying `MCSession`, handles `MCSessionDelegate` events.
 */
class Session: NSObject {

  // MARK: - Internal state
  internal private(set) var sessionState: Atomic<MCSessionState> = Atomic(.NotConnected)
  internal var didChangeStateHandler: ((MCSessionState) -> Void)?
  internal var didReceiveInputStreamHandler: ((NSInputStream, String) -> Void)?

  // MARK: - Private state
  private let session: MCSession
  private let identifier: MCPeerID
  private let didConnectHandler: () -> Void
  private let didNotConnectHandler: () -> Void

  // MARK: - Public methods
  init(session: MCSession,
       identifier: MCPeerID,
       connected: () -> Void,
       notConnected: () -> Void) {

    self.session = session
    self.identifier = identifier
    self.didConnectHandler = connected
    self.didNotConnectHandler = notConnected
    super.init()
    self.session.delegate = self
  }

  func startOutputStream(with name: String) throws -> NSOutputStream {
    do {
      return try session.startStreamWithName(name, toPeer: identifier)
    } catch {
      throw ThaliCoreError.ConnectionFailed
    }
  }

  func disconnect() {
    session.disconnect()
  }
}

// MARK: - MCSessionDelegate - Handling events for MCSession
extension Session: MCSessionDelegate {

  func session(session: MCSession, peer peerID: MCPeerID, didChangeState state: MCSessionState) {
    assert(identifier.displayName == peerID.displayName)

    sessionState.modify {
      $0 = state

      self.didChangeStateHandler?(state)

      switch state {
      case .NotConnected:
        self.didNotConnectHandler()
      case .Connected:
        self.didConnectHandler()
      case .Connecting:
        break
      }
    }

  }

  func session(session: MCSession,
               didReceiveStream stream: NSInputStream,
                                withName streamName: String,
                                         fromPeer peerID: MCPeerID) {
    assert(identifier.displayName == peerID.displayName)
    didReceiveInputStreamHandler?(stream, streamName)
  }

  func session(session: MCSession, didReceiveData data: NSData, fromPeer peerID: MCPeerID) {
    assert(identifier.displayName == peerID.displayName)
  }

  func session(session: MCSession,
               didStartReceivingResourceWithName resourceName: String,
                                                 fromPeer peerID: MCPeerID,
                                                          withProgress progress: NSProgress) {
    assert(identifier.displayName == peerID.displayName)
  }

  func session(session: MCSession,
               didFinishReceivingResourceWithName resourceName: String,
                                                  fromPeer peerID: MCPeerID,
                                                           atURL localURL: NSURL,
                                                                 withError error: NSError?) {
    assert(identifier.displayName == peerID.displayName)
  }
}
