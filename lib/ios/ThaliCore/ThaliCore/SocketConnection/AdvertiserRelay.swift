//
//  Thali CordovaPlugin
//  AdvertiserRelay.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

// MARK: - Methods that available for Relay<AdvertiserVirtualSocketBuilder>
final class AdvertiserRelay {

  // MARK: - Internal state
  internal var virtualSocketsAmount: Int {
    return virtualSockets.value.count
  }
  internal fileprivate(set) var clientPort: UInt16

  // MARK: - Private state
  fileprivate var tcpClient: TCPClient!
  fileprivate var nonTCPsession: Session
  fileprivate var virtualSocketsBuilders: Atomic<[String: AdvertiserVirtualSocketBuilder]>
  fileprivate var virtualSockets: Atomic<[GCDAsyncSocket: VirtualSocket]>

  // MARK: - Initialization
  init(with session: Session, on port: UInt16) {
    nonTCPsession = session
    clientPort = port
    virtualSocketsBuilders = Atomic([:])
    virtualSockets = Atomic([:])
    nonTCPsession.didReceiveInputStreamHandler = sessionDidReceiveInputStreamHandler
    tcpClient = TCPClient(with: didReadDataHandler, didDisconnect: didDisconnectHandler)
  }

  // MARK: - Internal methods
  func closeRelay() {
    tcpClient.disconnectClientsFromLocalhost()
  }

  func disconnectNonTCPSession() {
    nonTCPsession.disconnect()
  }

  // MARK: - Private handlers
  fileprivate func didReadDataFromStreamHandler(_ virtualSocket: VirtualSocket, data: Data) {
    guard let socket = virtualSockets.value.key(for: virtualSocket) else {
      virtualSocket.closeStreams()
      return
    }

    let noTimeout: TimeInterval = -1
    let defaultDataTag = 0
    socket.write(data, withTimeout: noTimeout, tag: defaultDataTag)
  }

  fileprivate func sessionDidReceiveInputStreamHandler(_ inputStream: InputStream,
                                                   inputStreamName: String) {
    createVirtualSocket(with: inputStream, inputStreamName: inputStreamName) {
      [weak self] virtualSocket, error in
      guard let strongSelf = self else { return }

      guard error == nil else {
        return
      }

      guard let virtualSocket = virtualSocket else {
        return
      }

      strongSelf.tcpClient.connectToLocalhost(onPort: strongSelf.clientPort, completion: {
        socket, port, error in

        guard let socket = socket else {
          return
        }

        virtualSocket.didOpenVirtualSocketHandler = strongSelf.didOpenVirtualSocketHandler
        virtualSocket.didReadDataFromStreamHandler = strongSelf.didReadDataFromStreamHandler
        virtualSocket.didCloseVirtualSocketHandler = strongSelf.didCloseVirtualSocketHandler

        strongSelf.virtualSockets.modify {
          $0[socket] = virtualSocket
        }

        virtualSocket.openStreams()
      })
    }
  }

  fileprivate func createVirtualSocket(with inputStream: InputStream,
                                        inputStreamName: String,
                                        completion: @escaping ((VirtualSocket?, Error?) -> Void)) {
    let virtualSockBuilder = AdvertiserVirtualSocketBuilder(with: nonTCPsession) {
      virtualSocket, error in
      completion(virtualSocket, error)
    }

    virtualSockBuilder.createVirtualSocket(with: inputStream, inputStreamName: inputStreamName)
  }

  fileprivate func didOpenVirtualSocketHandler(_ virtualSocket: VirtualSocket) {

  }

  fileprivate func didCloseVirtualSocketHandler(_ virtualSocket: VirtualSocket) {
    virtualSockets.modify {
      if let socket = $0.key(for: virtualSocket) {
        socket.disconnect()
        $0.removeValue(forKey: socket)
      }
    }
  }

  fileprivate func didReadDataHandler(_ socket: GCDAsyncSocket, data: Data) {
    virtualSockets.withValue {
      let virtualSocket = $0[socket]
      virtualSocket?.writeDataToOutputStream(data)
    }
  }

  // TODO: add unit test (issue #1358)
  fileprivate func didDisconnectHandler(_ socket: GCDAsyncSocket) {
    virtualSockets.modify {
      let virtualSocket = $0[socket]
      virtualSocket?.closeStreams()
      $0.removeValue(forKey: socket)
    }
  }
}
