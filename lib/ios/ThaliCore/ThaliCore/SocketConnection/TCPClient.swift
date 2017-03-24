//
//  Thali CordovaPlugin
//  TCPClient.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

class TCPClient: NSObject {

  // MARK: - Private state
  private let socketQueue = dispatch_queue_create("org.thaliproject.GCDAsyncSocket.delegateQueue",
                                                  DISPATCH_QUEUE_CONCURRENT)
  private var activeConnections: Atomic<[GCDAsyncSocket]> = Atomic([])
  private var didReadDataHandler: ((GCDAsyncSocket, NSData) -> Void)
  private var didDisconnectHandler: ((GCDAsyncSocket) -> Void)
  private var port: UInt16! = 0

  // MARK: - Public methods
  required init(with didReadData: (GCDAsyncSocket, NSData) -> Void,
                     didDisconnect: (GCDAsyncSocket) -> Void) {
    didReadDataHandler = didReadData
    didDisconnectHandler = didDisconnect
    super.init()
  }

  func connectToLocalhost(onPort port: UInt16,
                          completion: (socket: GCDAsyncSocket?, port: UInt16?, error: ErrorType?)
                          -> Void) {

    do {
      let socket = GCDAsyncSocket()
      socket.delegate = self
      socket.delegateQueue = socketQueue
      try socket.connectToHost("127.0.0.1", onPort: port)
      self.port = port
      completion(socket: socket, port: port, error: nil)
    } catch _ {
      completion(socket: nil, port: port, error: ThaliCoreError.ConnectionFailed)
    }
  }

  func disconnectClientsFromLocalhost() {
    activeConnections.modify {
      $0.forEach { $0.disconnect() }
      $0.removeAll()
    }
  }
}

// MARK: - GCDAsyncSocketDelegate - Handling socket events
extension TCPClient: GCDAsyncSocketDelegate {

  func socket(sock: GCDAsyncSocket, didConnectToHost host: String, port: UInt16) {
    activeConnections.modify { $0.append(sock) }
    sock.readDataWithTimeout(-1, tag: 0)
    print("NATIVE: TCPClient socket did connect to host on port: \(port) expected port: \(self.port)")
  }

  func socketDidDisconnect(sock: GCDAsyncSocket, withError err: NSError?) {
    sock.delegate = nil

    activeConnections.modify {
      if let indexOfDisconnectedSocket = $0.indexOf(sock) {
        $0.removeAtIndex(indexOfDisconnectedSocket)
      }
    }

    didDisconnectHandler(sock)
    print("NATIVE: TCPClient socket did disconnect on port: \(port)")
  }

  func socket(sock: GCDAsyncSocket, didWriteDataWithTag tag: Int) {

  }

  func socket(sock: GCDAsyncSocket, didReadData data: NSData, withTag tag: Int) {
    didReadDataHandler(sock, data)
    print("NATIVE: TCPClient socket did read data on port: \(port) data size: \(data.length)")
  }
}
