//
//  Thali CordovaPlugin
//  TCPListener.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import Foundation

class TCPListener: NSObject {

    // MARK: - Internal state
    internal private(set) var socket: GCDAsyncSocket
    internal var socketDisconnectHandler:((socket: GCDAsyncSocket) -> Void)?
    internal var socketReadDataHandler:((data: NSData) -> Void)?
    internal var acceptNewConnectionHandler:((socket: GCDAsyncSocket) -> Void)?

    // MARK: - Private state
    private let socketQueue = dispatch_queue_create("org.thaliproject.GCDAsyncSocket.delegateQueue",
                                                    DISPATCH_QUEUE_CONCURRENT)
    private var activeConnections: Atomic<[GCDAsyncSocket]> = Atomic([])

    // MARK: - Public methods
    required override init() {
        socket = GCDAsyncSocket()
        super.init()
        socket.delegate = self
        socket.delegateQueue = socketQueue
    }

    func startListeningForIncomingConnections(onPort port: UInt16,
                                              completion: (port: UInt16?, error: ErrorType?)
                                              -> Void) {
        do {
            try socket.acceptOnPort(port)
            completion(port: socket.localPort, error: nil)
        } catch _ {
            completion(port: 0, error: ThaliCoreError.ConnectionFailed)
        }
    }

    func stopListeningForIncomingConnectionsAndCloseSocket() {
        socket.disconnect()
    }

    func connectToLocalhost(onPort port: UInt16,
                            completion: (port: UInt16?, error: ErrorType?) -> Void) {
        do {
            try socket.connectToHost("localhost", onPort: port)
            completion(port: port, error: nil)
        } catch _ {
            completion(port: port, error: ThaliCoreError.ConnectionFailed)
        }
    }

    func disconnectFromLocalhost() {
        socket.disconnect()
    }
}

// MARK: - GCDAsyncSocketDelegate - Handling socket events
extension TCPListener: GCDAsyncSocketDelegate {

    func socket(sock: GCDAsyncSocket, didConnectToHost host: String, port: UInt16) {

    }

    func socketDidDisconnect(sock: GCDAsyncSocket, withError err: NSError?) {
        // TODO: handle all kind of TCP socket error (07b9e28)
        sock.delegate = nil

        activeConnections.modify {
            if let indexOfDisconnectedSocket = $0.indexOf(sock) {
                $0.removeAtIndex(indexOfDisconnectedSocket)
            }
        }

        socketDisconnectHandler?(socket: sock)
    }

    func socket(sock: GCDAsyncSocket, didAcceptNewSocket newSocket: GCDAsyncSocket) {
        activeConnections.modify({ $0.append(newSocket) })
        acceptNewConnectionHandler?(socket: newSocket)
    }

    func socket(sock: GCDAsyncSocket, didWriteDataWithTag tag: Int) {

    }

    func socket(sock: GCDAsyncSocket, didReadData data: NSData, withTag tag: Int) {
        socketReadDataHandler?(data: data)
    }
}
