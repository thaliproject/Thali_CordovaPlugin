//
//  Thali CordovaPlugin
//  TCPServerMock.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import ThaliCore

class TCPServerMock: NSObject {

    private let tcpListener: GCDAsyncSocket
    private var activeConnections: Atomic<[GCDAsyncSocket]> = Atomic([])

    static private let delegateQueueName =
        "org.thaliproject.TCPServerMock.GCDAsyncSocket.delegateQueue"
    private let delegateQueue = dispatch_queue_create(delegateQueueName, DISPATCH_QUEUE_CONCURRENT)

    private var didAcceptConnectionHandler: () -> Void
    private var didReadDataHandler: (GCDAsyncSocket, NSData) -> Void
    private var didDisconnectHandler: (GCDAsyncSocket) -> Void

    init(didAcceptConnection: () -> Void,
         didReadData: (GCDAsyncSocket, NSData) -> Void,
         didDisconnect: (GCDAsyncSocket) -> Void) {
        tcpListener = GCDAsyncSocket()
        didAcceptConnectionHandler = didAcceptConnection
        didReadDataHandler = didReadData
        didDisconnectHandler = didDisconnect
        super.init()
        tcpListener.delegate = self
        tcpListener.delegateQueue = delegateQueue
    }

    /**
     Start listener on localhost.

     - parameters:
       - port:
         TCP port number that listens for incoming connections.

         Default value is 0 which means any available port.

     - returns:
       number of port that listens for connections.

     - throws:
       ThaliCoreError.ConnectionFailed if can't start listener on given port
     */
    func startListening(on port: UInt16 = 0) throws -> UInt16 {
        do {
            try tcpListener.acceptOnPort(port)
            return tcpListener.localPort
        } catch _ {
            throw ThaliCoreError.ConnectionFailed
        }
    }

    /***/
    func disconnectAllClients() {
        activeConnections.modify {
            $0.forEach { $0.disconnect() }
            $0.removeAll()
        }
    }

    /***/
    func sendRandomMessage(length length: Int) {
        guard length > 0 else { return }

        let randomMessage = String.random(length: length)
        let messageData = randomMessage.dataUsingEncoding(NSUTF8StringEncoding)

        activeConnections.withValue {
            $0.forEach { $0.writeData(messageData!, withTimeout: -1, tag: 0) }
        }
    }

    /***/
    func send(message: String) {
        guard let messageData = message.dataUsingEncoding(NSUTF8StringEncoding) else { return }

        while activeConnections.value.count == 0 {}
        activeConnections.withValue {
            $0.forEach { $0.writeData(messageData, withTimeout: -1, tag: 0) }
        }
    }
}

// MARK: GCDAsyncSocketDelegate events
extension TCPServerMock: GCDAsyncSocketDelegate {

    func socket(sock: GCDAsyncSocket, didAcceptNewSocket newSocket: GCDAsyncSocket) {
        activeConnections.modify {
            $0.append(newSocket)
            newSocket.readDataToData(GCDAsyncSocket.CRLFData(), withTimeout: -1, tag: 0)
        }

        didAcceptConnectionHandler()
    }

    func socketDidDisconnect(sock: GCDAsyncSocket, withError err: NSError?) {
        activeConnections.modify {
            if let indexOfDisconnectedSocket = $0.indexOf(sock) {
                $0.removeAtIndex(indexOfDisconnectedSocket)
            }
        }
        didDisconnectHandler(sock)
    }

    func socket(sock: GCDAsyncSocket, didReadData data: NSData, withTag tag: Int) {
        didReadDataHandler(sock, data)
    }

    func socket(sock: GCDAsyncSocket, didConnectToHost host: String, port: UInt16) {}
    func socket(sock: GCDAsyncSocket, didWriteDataWithTag tag: Int) {}
    func socketDidCloseReadStream(sock: GCDAsyncSocket) {}
}
