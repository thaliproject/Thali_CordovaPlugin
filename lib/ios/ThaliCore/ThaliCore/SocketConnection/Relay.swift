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
    internal var listenerPort: UInt16? {
        return tcpListener?.socket?.localPort
    }

    // MARK: - Private state
    private var session: Session
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
    func createTCPListenerWithCompletionHandler(completion: (port: UInt16?, error: ErrorType?)
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

                    completion(port: port, error: error)
                }
            } catch let error {
                completion(port: 0, error: error)
            }

            tcpListener?.socketFailureHandler = socketFailureHandler
            tcpListener?.socketReadDataHandler = socketReadDataHandler
        }
    }

    func closeTCPListener() {
        tcpListener?.acceptNewConnectionHandler = nil
        tcpListener?.socketFailureHandler = nil
        tcpListener?.socketReadDataHandler = nil
        tcpListener?.stopListeningForIncomingConnectionsAndCloseSocket()
        tcpListener = nil
    }

    func createSocketAndConnect(to preConfiguredPort: UInt16,
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

    func closeMPCFSession() {
        self.session.disconnect()
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
                        strongSelf.closeTCPListener()
                    }
                }
            } else {
                if let streamPair = streamPair {
                    strongSelf.virtualSocket = VirtualSocket(with: streamPair.inputStream,
                                                             outputStream: streamPair.outputStream)
                    strongSelf.virtualSocket?.readDataFromStreamHandler =
                        strongSelf.readDataFromInputStream
                    strongSelf.openAndBindVirtualSocket()
                }
            }
        }
    }

    func openAndBindVirtualSocket() {
        self.virtualSocket?.openStreams()
    }

    func closeVirtualSocket() {
        self.virtualSocket?.closeStreams()
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
