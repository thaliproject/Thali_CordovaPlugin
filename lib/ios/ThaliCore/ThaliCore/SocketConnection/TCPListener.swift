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

    // MARK: - Public state
    var socketFailureHandler:((socket: GCDAsyncSocket) -> Void)? = nil
    var socketReadDataHandler:((data: NSData) -> Void)? = nil

    // MARK: - Internal state
    internal private(set) var socket: GCDAsyncSocket?

    // MARK: - Private state
    private let socketQueue = dispatch_queue_create("org.thaliproject.GCDAsyncSocket.delegateQueue",
                                                    DISPATCH_QUEUE_CONCURRENT)

    private var activeConnections: Atomic<[GCDAsyncSocket]> = Atomic([])
    private let acceptNewConnectionHandler:(onSocket: GCDAsyncSocket) -> Void

    init(withAcceptNewConnectionHandler newConnectionHandler: (onSocket: GCDAsyncSocket) -> Void) {
        self.acceptNewConnectionHandler = newConnectionHandler
    }

    func startListeningForIncomingConnections(onPort port: UInt16,
                                              completion: (port: UInt16?, error: ErrorType?)
                                                -> Void) throws {

        socket = GCDAsyncSocket(delegate: self, delegateQueue: socketQueue)

        do {
            try socket?.acceptOnPort(port)
        } catch _ {
            throw ThaliCoreError.ConnectionFailed
        }

        completion(port: socket?.localPort, error: nil)
    }

    func stopListeningForIncomingConnectionsAndCloseSocket() {
        if nil != socket {
            socket?.disconnect()
            socket?.delegate = nil
            socket = nil
        }
    }

    func connectToLocalhost(onPort port: UInt16,
                            completion: (port: UInt16?, error: ErrorType?) -> Void) throws {

        socket = GCDAsyncSocket(delegate: self, delegateQueue: socketQueue)

        do {
            try socket?.connectToHost("localhost", onPort: port)
        } catch _ {
            throw ThaliCoreError.ConnectionFailed
        }

        completion(port: port, error: nil)
    }
}

extension TCPListener: GCDAsyncSocketDelegate {

    func socket(sock: GCDAsyncSocket, didConnectToHost host: String, port: UInt16) {

    }

    func socketDidDisconnect(sock: GCDAsyncSocket, withError err: NSError?) {
        activeConnections.modify {
            if let indexOfSocket = $0.indexOf(sock) {
                $0.removeAtIndex(indexOfSocket)
            }
        }

        socketFailureHandler?(socket: sock)
    }

    func socket(sock: GCDAsyncSocket, didAcceptNewSocket newSocket: GCDAsyncSocket) {
        activeConnections.modify({ $0.append(newSocket) })
        acceptNewConnectionHandler(onSocket: newSocket)
    }

    func socket(sock: GCDAsyncSocket, didWriteDataWithTag tag: Int) {

    }

    func socket(sock: GCDAsyncSocket, didReadData data: NSData, withTag tag: Int) {
        socketReadDataHandler?(data: data)
    }
}
