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
  private let tcpClient: GCDAsyncSocket
  private let socketQueue = dispatch_queue_create(
    "org.thaliproject.TCPClientMock.GCDAsyncSocket.delegateQueue",
    DISPATCH_QUEUE_CONCURRENT
  )
  private var didReadDataHandler: (NSData) -> Void
  private var didConnectHandler: () -> Void
  private var didDisconnectHandler: () -> Void

  // MARK: - Initialization
  init(didReadData: (NSData) -> Void, didConnect: () -> Void, didDisconnect: () -> Void) {
    tcpClient = GCDAsyncSocket()
    didReadDataHandler = didReadData
    didConnectHandler = didConnect
    didDisconnectHandler = didDisconnect
    super.init()
    tcpClient.delegate = self
    tcpClient.delegateQueue = socketQueue
  }

  // MARK: - Internal methods
  func connectToLocalHost(on port: UInt16, errorHandler: (ErrorType) -> Void) {
    do {
      try tcpClient.connectToHost("127.0.0.1", onPort: port)
    } catch let error {
      errorHandler(error)
    }
  }

  func disconnect() {
    tcpClient.disconnect()
  }

  func send(message: String) {
    let messageData = message.dataUsingEncoding(NSUTF8StringEncoding)
    tcpClient.writeData(messageData!, withTimeout: -1, tag: 0)
  }

  func sendRandomMessage(length length: Int) {
    let randomMessage = String.random(length: length) + "/r/n"
    let messageData = randomMessage.dataUsingEncoding(NSUTF8StringEncoding)
    tcpClient.writeData(messageData!, withTimeout: -1, tag: 0)
  }
}

// MARK: - GCDAsyncSocketDelegate
extension TCPClientMock: GCDAsyncSocketDelegate {

  func socketDidDisconnect(sock: GCDAsyncSocket, withError err: NSError?) {
    didDisconnectHandler()
  }

  func socket(sock: GCDAsyncSocket, didConnectToHost host: String, port: UInt16) {
    sock.readDataWithTimeout(-1, tag: 0)
    didConnectHandler()
  }

  func socket(sock: GCDAsyncSocket, didWriteDataWithTag tag: Int) {}

  func socket(sock: GCDAsyncSocket, didReadData data: NSData, withTag tag: Int) {
    didReadDataHandler(data)
  }

  func socketDidCloseReadStream(sock: GCDAsyncSocket) {}
}
