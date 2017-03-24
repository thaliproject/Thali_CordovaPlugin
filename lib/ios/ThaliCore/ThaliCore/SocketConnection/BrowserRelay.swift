//
//  Thali CordovaPlugin
//  BrowserRelay.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

// MARK: - Methods that available for Relay<BrowserVirtualSocketBuilder>
final class BrowserRelay {

  // MARK: - Internal state
  internal var virtualSocketsAmount: Int {
    return virtualSockets.value.count
  }
  internal var listenerPort: UInt16 {
    return tcpListener.listenerPort
  }

  // MARK: - Private state
  private var tcpListener: TCPListener!
  private var nonTCPsession: Session
  private var virtualSocketBuilders: Atomic<[String: BrowserVirtualSocketBuilder]>
  private var virtualSockets: Atomic<[GCDAsyncSocket: VirtualSocket]>
  private let createVirtualSocketTimeout: NSTimeInterval
  private let maxVirtualSocketsCount = 16

  // MARK: - Initialization
  init(with session: Session, createVirtualSocketTimeout: NSTimeInterval) {
    self.nonTCPsession = session
    self.createVirtualSocketTimeout = createVirtualSocketTimeout
    self.virtualSockets = Atomic([:])
    self.virtualSocketBuilders = Atomic([:])
    nonTCPsession.didReceiveInputStreamHandler = sessionDidReceiveInputStreamHandler
    tcpListener = TCPListener(with: didReadDataFromSocketHandler,
                              socketDisconnected: didSocketDisconnectHandler,
                              stoppedListening: didStopListeningForConnections)
  }

  // MARK: - Internal methods
  func openRelay(with completion: (port: UInt16?, error: ErrorType?) -> Void) {
    let anyAvailablePort: UInt16 = 0
    tcpListener.startListeningForConnections(on: anyAvailablePort,
                                             connectionAccepted: didAcceptConnectionHandler) {
      port, error in
      completion(port: port, error: error)

      print("NATIVE: browser socket started listening on port \(port) error: \(error.debugDescription)")
    }
  }

  func closeRelay() {
    tcpListener.stopListeningForConnectionsAndDisconnectClients()
  }

  func disconnectNonTCPSession() {
    nonTCPsession.disconnect()
  }

  // MARK: - Private handlers
  private func sessionDidReceiveInputStreamHandler(inputStream: NSInputStream,
                                                   inputStreamName: String) {
    if let builder = virtualSocketBuilders.value[inputStreamName] {
      builder.completeVirtualSocket(with: inputStream)
    } else {
      inputStream.close()
    }
  }

  private func didReadDataFromStreamHandler(on virtualSocket: VirtualSocket, data: NSData) {
    virtualSockets.withValue {
      if let socket = $0.key(for: virtualSocket) {
        let noTimeout: NSTimeInterval = -1
        let defaultDataTag = 0
        socket.writeData(data, withTimeout: noTimeout, tag: defaultDataTag)
      }
    }
  }

  private func didAcceptConnectionHandler(socket: GCDAsyncSocket) {
    createVirtualSocket {
      [weak self] virtualSocket, error in
      guard let strongSelf = self else { return }

      guard error == nil else {
        socket.disconnect()
        return
      }

      guard let virtualSocket = virtualSocket else {
        socket.disconnect()
        return
      }

      virtualSocket.didOpenVirtualSocketHandler = strongSelf.didInputStreamOpenedHandler
      virtualSocket.didReadDataFromStreamHandler = strongSelf.didReadDataFromStreamHandler
      virtualSocket.didCloseVirtualSocketHandler = strongSelf.didCloseVirtualSocketHandler

      strongSelf.virtualSockets.modify {
        $0[socket] = virtualSocket
      }

      virtualSocket.openStreams()
    }
  }

  private func didReadDataFromSocketHandler(socket: GCDAsyncSocket, data: NSData) {
    guard let virtualSocket = virtualSockets.value[socket] else {
      socket.disconnect()
      return
    }

    virtualSocket.writeDataToOutputStream(data)
  }

  private func didCloseVirtualSocketHandler(virtualSocket: VirtualSocket) {
    virtualSockets.modify {
      if let socket = $0.key(for: virtualSocket) {
        socket.disconnect()
        $0.removeValueForKey(socket)
      }
    }
  }

  private func didSocketDisconnectHandler(socket: GCDAsyncSocket) {
    self.virtualSockets.modify {
      let virtualSocket = $0[socket]
      virtualSocket?.closeStreams()
      $0.removeValueForKey(socket)
    }
  }

  private func didStopListeningForConnections() {
    disconnectNonTCPSession()
  }

  private func didInputStreamOpenedHandler(virtualSocket: VirtualSocket) {
    guard let socket = virtualSockets.value.key(for: virtualSocket) else {
      virtualSocket.closeStreams()
      return
    }
    socket.readDataWithTimeout(-1, tag: 1)
  }

  // MARK: - Private methods
  private func createVirtualSocket(with completion: ((VirtualSocket?, ErrorType?) -> Void)) {

    guard virtualSockets.value.count <= maxVirtualSocketsCount else {
      completion(nil, ThaliCoreError.ConnectionFailed)
      return
    }

    let newStreamName = NSUUID().UUIDString
    let virtualSocketBuilder = BrowserVirtualSocketBuilder(
      with: nonTCPsession,
      streamName: newStreamName,
      streamReceivedBackTimeout: createVirtualSocketTimeout)

    virtualSocketBuilders.modify {
      $0[virtualSocketBuilder.streamName] = virtualSocketBuilder
    }

    virtualSocketBuilder.startBuilding {
      virtualSocket, error in

      self.virtualSocketBuilders.modify {
        $0.removeValueForKey(newStreamName)
      }

      completion(virtualSocket, error)
    }
  }
}
