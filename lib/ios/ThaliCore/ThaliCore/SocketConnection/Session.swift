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

  /**
   Indicates the current state of a given peer within a `Session`.
   */
  internal fileprivate(set) var sessionState: Atomic<MCSessionState> = Atomic(.notConnected)

  /**
   Handles changing `sessionState`.
   */
  internal var didChangeStateHandler: ((MCSessionState) -> Void)?

  /**
   Handles receiving new NSInputStream.
   */
  internal var didReceiveInputStreamHandler: ((InputStream, String) -> Void)?

  // MARK: - Private state

  /**
   Represents `MCSession` object which enables and manages communication among all peers.
   */
  fileprivate let session: MCSession

  /**
   Represents a peer in a session.
   */
  fileprivate let identifier: MCPeerID

  /**
   Handles underlying *MCSessionStateConnected* state.
   */
  fileprivate let didConnectHandler: () -> Void

  /**
   Handles underlying *MCSessionStateNotConnected* state.
   */
  fileprivate let didNotConnectHandler: () -> Void

  // MARK: - Public methods

  /**
   Returns a new `Session` object.

   - parameters:
     - session:
       Represents underlying `MCSession` object.

     - identifier:
       Represents a peer in a session.

     - connected:
       Called when the nearby peer’s state changes to `MCSessionStateConnected`.

       It means the nearby peer accepted the invitation and is now connected to the session.

     - notConnected:
       Called when the nearby peer’s state changes to `MCSessionStateNotConnected`.

       It means the nearby peer declined the invitation, the connection could not be established,
       or a previously connected peer is no longer connected.

   - returns:
     An initialized `Session` object.
   */
  init(session: MCSession,
       identifier: MCPeerID,
       connected: @escaping () -> Void,
       notConnected: @escaping () -> Void) {
    self.session = session
    self.identifier = identifier
    self.didConnectHandler = connected
    self.didNotConnectHandler = notConnected
    super.init()
    self.session.delegate = self
  }

  /**
   Starts new `NSOutputStream` which represents a byte stream to a nearby peer.

   - parameters:
     - name:
       A name for the stream.

   - throws:
     ConnectionFailed if a stream could not be established.

   - returns:
     `NSOutputStream` object upon success.
   */
  func startOutputStream(with name: String) throws -> OutputStream {
    do {
      return try session.startStream(withName: name, toPeer: identifier)
    } catch {
      throw ThaliCoreError.ConnectionFailed
    }
  }

  /**
   Disconnects the local peer from the session.
   */
  func disconnect() {
    session.disconnect()
  }
}

// MARK: - MCSessionDelegate - Handling events for MCSession
extension Session: MCSessionDelegate {

  func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
    assert(identifier.displayName == peerID.displayName)

    sessionState.modify {
      $0 = state
      self.didChangeStateHandler?(state)

      switch state {
      case .notConnected:
        self.didNotConnectHandler()
      case .connected:
        self.didConnectHandler()
      case .connecting:
        break
      }
    }
  }

  func session(_ session: MCSession,
               didReceive stream: InputStream,
               withName streamName: String,
               fromPeer peerID: MCPeerID) {
    assert(identifier.displayName == peerID.displayName)
    didReceiveInputStreamHandler?(stream, streamName)
  }

  func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
    assert(identifier.displayName == peerID.displayName)
  }

  func session(_ session: MCSession,
               didStartReceivingResourceWithName resourceName: String,
               fromPeer peerID: MCPeerID,
               with progress: Progress) {
    assert(identifier.displayName == peerID.displayName)
  }

  func session(_ session: MCSession,
               didFinishReceivingResourceWithName resourceName: String,
               fromPeer peerID: MCPeerID,
               at localURL: URL,
               withError error: Error?) {
    assert(identifier.displayName == peerID.displayName)
  }
}
