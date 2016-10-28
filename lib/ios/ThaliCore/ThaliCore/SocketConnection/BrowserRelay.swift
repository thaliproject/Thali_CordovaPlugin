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
  fileprivate var tcpListener: TCPListener!
  fileprivate var nonTCPsession: Session
  fileprivate var virtualSocketBuilders: Atomic<[String: BrowserVirtualSocketBuilder]>
  fileprivate var virtualSockets: Atomic<[GCDAsyncSocket: VirtualSocket]>
  fileprivate let createVirtualSocketTimeout: TimeInterval
  fileprivate let maxVirtualSocketsCount = 16

  // MARK: - Initialization
  init(with session: Session, createVirtualSocketTimeout: TimeInterval) {
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
  func openRelay(with completion: @escaping (_ port: UInt16?, _ error: Error?) -> Void) {
    let anyAvailablePort: UInt16 = 0
    tcpListener.startListeningForConnections(on: anyAvailablePort,
                                             connectionAccepted: didAcceptConnectionHandler) {
      port, error in
      completion(port, error)
    }
  }

  func closeRelay() {
    tcpListener.stopListeningForConnectionsAndDisconnectClients()
  }

  func disconnectNonTCPSession() {
    nonTCPsession.disconnect()
  }

  // MARK: - Private handlers
  fileprivate func sessionDidReceiveInputStreamHandler(_ inputStream: InputStream,
                                                       inputStreamName: String) {
    if let builder = virtualSocketBuilders.value[inputStreamName] {
      builder.completeVirtualSocket(with: inputStream)
    } else {
      inputStream.close()
    }
  }

  fileprivate func didReadDataFromStreamHandler(on virtualSocket: VirtualSocket, data: Data) {
    virtualSockets.withValue {
      if let socket = $0.key(for: virtualSocket) {
        let noTimeout: TimeInterval = -1
        let defaultDataTag = 0
        socket.write(data, withTimeout: noTimeout, tag: defaultDataTag)
      }
    }
  }

  fileprivate func didAcceptConnectionHandler(_ socket: GCDAsyncSocket) {
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

  fileprivate func didReadDataFromSocketHandler(_ socket: GCDAsyncSocket, data: Data) {
    guard let virtualSocket = virtualSockets.value[socket] else {
      socket.disconnect()
      return
    }

    virtualSocket.writeDataToOutputStream(data)
  }

  fileprivate func didCloseVirtualSocketHandler(_ virtualSocket: VirtualSocket) {
    virtualSockets.modify {
      if let socket = $0.key(for: virtualSocket) {
        socket.disconnect()
        $0.removeValue(forKey: socket)
      }
    }
  }

  fileprivate func didSocketDisconnectHandler(_ socket: GCDAsyncSocket) {
    self.virtualSockets.modify {
      let virtualSocket = $0[socket]
      virtualSocket?.closeStreams()
      $0.removeValue(forKey: socket)
    }
  }

  fileprivate func didStopListeningForConnections() {
    disconnectNonTCPSession()
  }

  fileprivate func didInputStreamOpenedHandler(_ virtualSocket: VirtualSocket) {
    guard let socket = virtualSockets.value.key(for: virtualSocket) else {
      virtualSocket.closeStreams()
      return
    }
    socket.readData(withTimeout: -1, tag: 1)
  }

  // MARK: - Private methods
  fileprivate func createVirtualSocket(
    with completion: @escaping ((VirtualSocket?, Error?) -> Void)) {

    guard virtualSockets.value.count <= maxVirtualSocketsCount else {
      completion(nil, ThaliCoreError.ConnectionFailed)
      return
    }

    let newStreamName = UUID().uuidString
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
        $0.removeValue(forKey: newStreamName)
      }

      completion(virtualSocket, error)
    }
  }
}
