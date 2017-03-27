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
  fileprivate let socketQueue = DispatchQueue(label: "org.thaliproject.GCDAsyncSocket.delegateQueue",
                                                  attributes: DispatchQueue.Attributes.concurrent)
  fileprivate var activeConnections: Atomic<[GCDAsyncSocket]> = Atomic([])
  fileprivate var didReadDataHandler: ((GCDAsyncSocket, Data) -> Void)
  fileprivate var didDisconnectHandler: ((GCDAsyncSocket) -> Void)

  // MARK: - Public methods
  required init(with didReadData: @escaping (GCDAsyncSocket, Data) -> Void,
                     didDisconnect: @escaping (GCDAsyncSocket) -> Void) {
    didReadDataHandler = didReadData
    didDisconnectHandler = didDisconnect
    super.init()
  }

  func connectToLocalhost(onPort port: UInt16,
                          completion: (_ socket: GCDAsyncSocket?, _ port: UInt16?, _ error: Error?)
                          -> Void) {

    do {
      let socket = GCDAsyncSocket()
      socket.delegate = self
      socket.delegateQueue = socketQueue
      try socket.connect(toHost: "127.0.0.1", onPort: port)
      completion(socket, port, nil)
    } catch _ {
      completion(nil, port, ThaliCoreError.ConnectionFailed)
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

  func socket(_ sock: GCDAsyncSocket, didConnectToHost host: String, port: UInt16) {
    activeConnections.modify { $0.append(sock) }
    sock.readData(withTimeout: -1, tag: 0)
  }

  func socketDidDisconnect(_ sock: GCDAsyncSocket, withError err: NSError?) {
    sock.delegate = nil

    activeConnections.modify {
      if let indexOfDisconnectedSocket = $0.index(of: sock) {
        $0.remove(at: indexOfDisconnectedSocket)
      }
    }

    didDisconnectHandler(sock)
  }

  func socket(_ sock: GCDAsyncSocket, didWriteDataWithTag tag: Int) {

  }

  func socket(_ sock: GCDAsyncSocket, didRead data: Data, withTag tag: Int) {
    didReadDataHandler(sock, data)
  }
}
