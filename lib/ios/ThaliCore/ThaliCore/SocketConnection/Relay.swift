//
//  Thali CordovaPlugin
//  Relay.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//


import Foundation

final class Relay<Builder: VirtualSocketBuilder>: NSObject {

    // MARK: - Internal state
    internal private(set) var session: Session
    internal var listenerPort: UInt16? {
        return tcpListener?.socket?.localPort
    }

    // MARK: - Private state
    private var virtualSocket: VirtualSocket?
    private var tcpListener: TCPListener?
    private let createSocketTimeout: NSTimeInterval

    // MARK: - Public methods
    init(with session: Session, createSocketTimeout: NSTimeInterval) {
        self.session = session
        self.createSocketTimeout = createSocketTimeout
        super.init()
    }

    // MARK: - Public methods
    func createTCPListenerWithCompletionHandler(completionHandler: (port: UInt16?,
                                                                    error: ErrorType?)
                                                -> Void) {

        tcpListener = TCPListener()
        tcpListener?.acceptNewConnectionHandler = {
            socket in

            self.createVirtualSocket()
        }

        if nil != tcpListener {
            do {
                let anyAvailablePort: UInt16? = 0
                try tcpListener?.startListeningForIncomingConnections(onPort: anyAvailablePort!) {
                    port, error in

                    completionHandler(port: port, error: error)
                }
            } catch let error {
                completionHandler(port: 0, error: error)
            }

            tcpListener?.socketFailureHandler = socketFailureHandler
            tcpListener?.socketReadDataHandler = socketReadDataHandler
        }
    }

    func closeTCPListener() {
        tcpListener?.stopListeningForIncomingConnectionsAndCloseSocket()
        tcpListener?.acceptNewConnectionHandler = nil
        tcpListener = nil
    }

    func createTCPListenerAndConnect(to preConfiguredPort: UInt16,
                                     withCompletion completion: (port: UInt16?, error: ErrorType?)
        -> Void) {
        tcpListener = TCPListener()
        tcpListener?.acceptNewConnectionHandler = {
            socket in

            socket.readDataWithTimeout(-1, tag: 0)
        }

        if nil != tcpListener {
            do {
                try tcpListener?.connectToLocalhost(onPort: preConfiguredPort) {
                    port, error in

                    completion(port: port, error: error)
                }
            } catch let error {
                completion(port: 0, error: error)
            }
        }
    }

    func createVirtualSocket() {
        let _ = Builder(session: self.session, streamReceiveTimeout: createSocketTimeout) {
            [weak self] streamPair, error in

            guard let strongSelf = self else {
                return
            }

            if error != nil {
                if let thaliCoreError = error as? ThaliCoreError {
                    if thaliCoreError == ThaliCoreError.ConnectionTimedOut {
                        strongSelf.tcpListener?.stopListeningForIncomingConnectionsAndCloseSocket()
                    }
                }
            } else {
                if let inputStream = streamPair?.0, outputStream = streamPair?.1 {
                    strongSelf.virtualSocket = VirtualSocket(with: inputStream,
                                                             outputStream: outputStream)
                    strongSelf.virtualSocket?.readDataFromStreamHandler =
                        strongSelf.readDataFromInputStream
                    strongSelf.virtualSocket?.open()
                }

            }
        }
    }

    func openAndBindVirtualSocket() {
        self.virtualSocket?.open()
    }

    func closeVirtualSocket() {
        self.virtualSocket?.close()
    }

    // MARK: - Private methods
    private func socketFailureHandler(socket: GCDAsyncSocket) {
        self.session.disconnect()
    }

    private func socketReadDataHandler(data: NSData) {
        writeDataToOutputStream(data)
    }

    private func readDataFromInputStream(data: NSData) {
        tcpListener?.socket?.writeData(data, withTimeout: -1, tag: 0)
    }

    private func writeDataToOutputStream(data: NSData) {
        let dataLength = data.length
        let buffer: [UInt8] = Array(
            UnsafeBufferPointer(start: UnsafePointer<UInt8>(data.bytes), count: dataLength)
        )

        let bytesWritten = self.virtualSocket?.outputStream?.write(buffer, maxLength: dataLength)

        if bytesWritten < 0 { }
    }
}
