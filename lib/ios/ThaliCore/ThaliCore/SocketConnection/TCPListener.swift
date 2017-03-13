//
//  Thali CordovaPlugin
//  TCPListener.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

/**
 Provides simple methods that listen for and accept incoming TCP connection requests.
 */
class TCPListener: NSObject {

  // MARK: - Internal state
  internal var listenerPort: UInt16 {
    return socket.localPort
  }

  // MARK: - Private state
  private let socket: GCDAsyncSocket
  private var listening = false

  private let socketQueue = dispatch_queue_create("org.thaliproject.GCDAsyncSocket.delegateQueue",
                                                  DISPATCH_QUEUE_CONCURRENT)
  private let activeConnections: Atomic<[GCDAsyncSocket]> = Atomic([])

  private var didAcceptConnectionHandler: ((GCDAsyncSocket) -> Void)?
  private let didReadDataFromSocketHandler: ((GCDAsyncSocket, NSData) -> Void)
  private let didSocketDisconnectHandler: ((GCDAsyncSocket) -> Void)
  private let didStoppedListeningHandler: () -> Void

  // MARK: - Initialization
  required init(with didReadDataFromSocket: (GCDAsyncSocket, NSData) -> Void,
                     socketDisconnected: (GCDAsyncSocket) -> Void,
                     stoppedListening: () -> Void) {
    socket = GCDAsyncSocket()
    didReadDataFromSocketHandler = didReadDataFromSocket
    didSocketDisconnectHandler = socketDisconnected
    didStoppedListeningHandler = stoppedListening
    super.init()
    socket.delegate = self
    socket.delegateQueue = socketQueue
  }

  // MARK: - Internal methods
  func startListeningForConnections(on port: UInt16,
                                       connectionAccepted: (GCDAsyncSocket) -> Void,
                                       completion: (port: UInt16?, error: ErrorType?) -> Void) {
    if !listening {
      do {
        try socket.acceptOnPort(port)
        listening = true
        didAcceptConnectionHandler = connectionAccepted
        completion(port: socket.localPort, error: nil)
      } catch _ {
        listening = false
        completion(port: 0, error: ThaliCoreError.ConnectionFailed)
      }
    }
  }

  func stopListeningForConnectionsAndDisconnectClients() {
    if listening {
      listening = false
      socket.disconnect()
    }
  }
}

// MARK: - GCDAsyncSocketDelegate - Handling socket events
extension TCPListener: GCDAsyncSocketDelegate {

  func socketDidDisconnect(sock: GCDAsyncSocket, withError err: NSError?) {
    if sock == socket {
      socket.delegate = nil
      socket.delegateQueue = nil
      activeConnections.modify {
        $0.forEach { $0.disconnect() }
        $0.removeAll()
      }
      didStoppedListeningHandler()
    } else {
      activeConnections.modify {
        if let indexOfDisconnectedSocket = $0.indexOf(sock) {
          $0.removeAtIndex(indexOfDisconnectedSocket)
        }
      }
      didSocketDisconnectHandler(sock)
    }
  }

  func socket(sock: GCDAsyncSocket, didAcceptNewSocket newSocket: GCDAsyncSocket) {
    activeConnections.modify { $0.append(newSocket) }
    didAcceptConnectionHandler?(newSocket)
  }

  func socket(sock: GCDAsyncSocket, didReadData data: NSData, withTag tag: Int) {
    didReadDataFromSocketHandler(sock, data)
    sock.readDataWithTimeout(-1, tag: 0)
  }
}
