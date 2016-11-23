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
  fileprivate let socket: GCDAsyncSocket
  fileprivate var listening = false

  fileprivate let socketQueue = DispatchQueue(
                                  label: "org.thaliproject.GCDAsyncSocket.delegateQueue",
                                  attributes: DispatchQueue.Attributes.concurrent
                                )
  fileprivate let activeConnections: Atomic<[GCDAsyncSocket]> = Atomic([])

  fileprivate var didAcceptConnectionHandler: ((GCDAsyncSocket) -> Void)?
  fileprivate let didReadDataFromSocketHandler: ((GCDAsyncSocket, Data) -> Void)
  fileprivate let didSocketDisconnectHandler: ((GCDAsyncSocket) -> Void)
  fileprivate let didStoppedListeningHandler: () -> Void

  // MARK: - Initialization
  required init(with didReadDataFromSocket: @escaping (GCDAsyncSocket, Data) -> Void,
                socketDisconnected: @escaping (GCDAsyncSocket) -> Void,
                stoppedListening: @escaping () -> Void) {
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
                                    connectionAccepted: @escaping (GCDAsyncSocket) -> Void,
                                    completion: (_ port: UInt16?, _ error: Error?) -> Void) {
    if !listening {
      do {
        try socket.accept(onPort: port)
        listening = true
        didAcceptConnectionHandler = connectionAccepted
        completion(socket.localPort, nil)
      } catch _ {
        listening = false
        completion(0, ThaliCoreError.ConnectionFailed)
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

  func socketDidDisconnect(_ sock: GCDAsyncSocket, withError err: Error?) {
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
        if let indexOfDisconnectedSocket = $0.index(of: sock) {
          $0.remove(at: indexOfDisconnectedSocket)
        }
      }
      didSocketDisconnectHandler(sock)
    }
  }

  func socket(_ sock: GCDAsyncSocket, didAcceptNewSocket newSocket: GCDAsyncSocket) {
    activeConnections.modify { $0.append(newSocket) }
    didAcceptConnectionHandler?(newSocket)
  }

  func socket(_ sock: GCDAsyncSocket, didRead data: Data, withTag tag: Int) {
    didReadDataFromSocketHandler(sock, data)
    sock.readData(withTimeout: -1, tag: 0)
  }
}
