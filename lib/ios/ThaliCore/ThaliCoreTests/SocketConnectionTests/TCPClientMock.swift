//
//  Thali CordovaPlugin
//  TCPClientMock.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import ThaliCore

class TCPClientMock: NSObject {

  // MARK: - Private state
  fileprivate let tcpClient: GCDAsyncSocket
  fileprivate let socketQueue = DispatchQueue(
    label: "org.thaliproject.TCPClientMock.GCDAsyncSocket.delegateQueue",
    attributes: DispatchQueue.Attributes.concurrent
  )
  fileprivate var didReadDataHandler: (Data) -> Void
  fileprivate var didConnectHandler: () -> Void
  fileprivate var didDisconnectHandler: () -> Void

  // MARK: - Initialization
  init(didReadData: @escaping (Data) -> Void,
       didConnect: @escaping () -> Void,
       didDisconnect: @escaping () -> Void) {
    tcpClient = GCDAsyncSocket()
    didReadDataHandler = didReadData
    didConnectHandler = didConnect
    didDisconnectHandler = didDisconnect
    super.init()
    tcpClient.delegate = self
    tcpClient.delegateQueue = socketQueue
  }

  // MARK: - Internal methods
  func connectToLocalHost(on port: UInt16, errorHandler: (Error) -> Void) {
    do {
      try tcpClient.connect(toHost: "127.0.0.1", onPort: port)
    } catch let error {
      errorHandler(error)
    }
  }

  func disconnect() {
    tcpClient.disconnect()
  }

  func send(_ message: String) {
    let messageData = message.data(using: String.Encoding.utf8)
    tcpClient.write(messageData!, withTimeout: -1, tag: 0)
  }

  func sendRandomMessage(length: Int) {
    let randomMessage = String.random(length: length) + "/r/n"
    let messageData = randomMessage.data(using: String.Encoding.utf8)
    tcpClient.write(messageData!, withTimeout: -1, tag: 0)
  }
}

// MARK: - GCDAsyncSocketDelegate
extension TCPClientMock: GCDAsyncSocketDelegate {

  func socketDidDisconnect(_ sock: GCDAsyncSocket, withError err: NSError?) {
    didDisconnectHandler()
  }

  func socket(_ sock: GCDAsyncSocket, didConnectToHost host: String, port: UInt16) {
    sock.readData(withTimeout: -1, tag: 0)
    didConnectHandler()
  }

  func socket(_ sock: GCDAsyncSocket, didWriteDataWithTag tag: Int) {}

  func socket(_ sock: GCDAsyncSocket, didRead data: Data, withTag tag: Int) {
    didReadDataHandler(data)
  }

  func socketDidCloseReadStream(_ sock: GCDAsyncSocket) {}
}
