//
//  Thali CordovaPlugin
//  Relay.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//


import Foundation

final class Relay<SocketBuilder: VirtualSocketBuilder>: NSObject {

    // MARK: - Internal state
    internal var listenerPort: UInt16? {
        return tcpListener.socket.localPort
    }

    // MARK: - Private state
    private var nonTCPsession: Session
    private var tcpListener: TCPListener
    private var virtualNonTCPSocket: VirtualSocket?
    private let createSocketTimeout: NSTimeInterval

    // MARK: - Public methods
    init(with session: Session, createSocketTimeout: NSTimeInterval) {
        self.nonTCPsession = session
        self.createSocketTimeout = createSocketTimeout
        self.tcpListener = TCPListener()
        super.init()
    }

    // MARK: - Private methods
    // MARK: Handling non-TCP socket
    private func createNonTCPVirtualSocket() {
        let _ = SocketBuilder(with: nonTCPsession,
                              streamReceivedBackTimeout: createSocketTimeout) {
            [weak self] newStreamPair, error in

            guard let strongSelf = self else {
                return
            }

            guard error == nil else {
                strongSelf.disconnectNonTCPSession()
                return
            }

            if let streamPair = newStreamPair {
                strongSelf.virtualNonTCPSocket = VirtualSocket(
                    with: streamPair.inputStream,
                    outputStream: streamPair.outputStream
                )

                guard let virtualNonTCPSocket = strongSelf.virtualNonTCPSocket else {
                    return
                }

                virtualNonTCPSocket.readDataFromStreamHandler = strongSelf.readDataFromInputStream
                strongSelf.openStreamsOnNonTCPVirtualSocket()
            }
        }
    }

    private func openStreamsOnNonTCPVirtualSocket() {
        self.virtualNonTCPSocket?.openStreams()
    }

    private func closeNonTCPVirtualSocket() {
        self.virtualNonTCPSocket?.closeStreams()
    }

    // MARK: Handling non-TCP session
    func disconnectNonTCPSession() {
        self.nonTCPsession.disconnect()
    }

    // MARK: Handlers
    private func socketDisconnectHandler(socket: GCDAsyncSocket) {
        disconnectNonTCPSession()
    }

    private func socketReadDataHandler(data: NSData) {
        writeDataToOutputStream(data)
    }

    private func readDataFromInputStream(data: NSData) {
        let noTimeOut: NSTimeInterval = -1
        tcpListener.socket.writeData(data, withTimeout: noTimeOut, tag: 0)
    }

    private func writeDataToOutputStream(data: NSData) {
        let dataLength = data.length
        let buffer: [UInt8] = Array(
            UnsafeBufferPointer(start: UnsafePointer<UInt8>(data.bytes), count: dataLength)
        )

        let bytesWritten = self.virtualNonTCPSocket?.outputStream.write(buffer, maxLength: dataLength)

        if bytesWritten < 0 { }
    }
}

extension Relay where SocketBuilder: AdvertiserVirtualSocketBuilder {

    // MARK: - Public methods
    func openRelay(on port: UInt16, completion: (port: UInt16?, error: ErrorType?) -> Void) {
        createSocketAndConnect(to: port, with: completion)
        createNonTCPVirtualSocket()
    }

    func closeRelay() {
        disconnectTCPSocket()
        closeNonTCPVirtualSocket()
    }

    // MARK: - Private methods
    private func createSocketAndConnect(to preConfiguredPort: UInt16,
                                        with completion: (port: UInt16?, error: ErrorType?)
                                        -> Void) {
        tcpListener.acceptNewConnectionHandler = {
            socket in
            let noTimeOut: NSTimeInterval = -1
            socket.readDataWithTimeout(noTimeOut, tag: 0)
        }

        tcpListener.connectToLocalhost(onPort: preConfiguredPort) {
            port, error in
            completion(port: port, error: error)
        }
    }

    private func disconnectTCPSocket() {
        tcpListener.disconnectFromLocalhost()
    }
}

extension Relay where SocketBuilder: BrowserVirtualSocketBuilder {

    // MARK: - Public methods
    func openRelay(with completion: (port: UInt16?, error: ErrorType?) -> Void) {
        createTCPListener(with: completion)
    }

    func closeRelay() {
        closeNonTCPVirtualSocket()
        closeTCPListener()
    }

    // MARK: - Private methods
    private func createTCPListener(with completion: (port: UInt16?, error: ErrorType?) -> Void) {
        tcpListener.acceptNewConnectionHandler = {
            [weak self] socket in

            guard let strongSelf = self else {
                return
            }

            strongSelf.createNonTCPVirtualSocket()
        }

        let anyAvailablePort: UInt16? = 0
        tcpListener.startListeningForIncomingConnections(onPort: anyAvailablePort!) {
            port, error in
            completion(port: port, error: error)
        }

        tcpListener.socketDisconnectHandler = socketDisconnectHandler
        tcpListener.socketReadDataHandler = socketReadDataHandler
    }

    private func closeTCPListener() {
        tcpListener.acceptNewConnectionHandler = nil
        tcpListener.socketDisconnectHandler = nil
        tcpListener.socketReadDataHandler = nil
        tcpListener.stopListeningForIncomingConnectionsAndCloseSocket()
    }
}
