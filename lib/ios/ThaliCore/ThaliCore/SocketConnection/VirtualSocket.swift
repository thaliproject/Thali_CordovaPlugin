//
//  Thali CordovaPlugin
//  VirtualSocket.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import Foundation

public class VirtualSocket: NSObject {

    // MARK: - Internal state
    internal private(set) var inputStream: NSInputStream
    internal private(set) var outputStream: NSOutputStream
    internal var readDataFromStreamHandler: ((NSData) -> Void)?

    // MARK: - Public methods
    init(with inputStream: NSInputStream, outputStream: NSOutputStream) {
        self.inputStream = inputStream
        self.outputStream = outputStream
        super.init()
    }

    func openStreams() {
        inputStream.delegate = self
        inputStream.scheduleInRunLoop(NSRunLoop.mainRunLoop(), forMode: NSDefaultRunLoopMode)
        inputStream.open()

        outputStream.delegate = self
        outputStream.scheduleInRunLoop(NSRunLoop.mainRunLoop(), forMode: NSDefaultRunLoopMode)
        outputStream.open()
    }

    func closeStreams() {
        inputStream.close()
        inputStream.removeFromRunLoop(NSRunLoop.mainRunLoop(), forMode: NSDefaultRunLoopMode)

        outputStream.close()
        outputStream.removeFromRunLoop(NSRunLoop.mainRunLoop(), forMode: NSDefaultRunLoopMode)
    }
}

// MARK: - NSStreamDelegate - Handling stream events
extension VirtualSocket: NSStreamDelegate {

    // MARK: - Delegate methods
    public func stream(aStream: NSStream, handleEvent eventCode: NSStreamEvent) {
        if aStream == self.inputStream {
            handleEventOnInputStream(with: eventCode)
        } else if aStream == self.outputStream {
            handleEventOnOutputStream(with: eventCode)
        }
    }

    // MARK: - Private Helpers
    private func handleEventOnInputStream(with eventCode: NSStreamEvent) {
        switch eventCode {
        case [.HasBytesAvailable]:
            let maxBufferLength = 1024
            var buffer = [UInt8](count: maxBufferLength, repeatedValue: 0)

            let bytesReaded = self.inputStream.read(&buffer, maxLength: maxBufferLength)

            if bytesReaded >= 0 {
                let data = NSData(bytes: &buffer, length: bytesReaded)
                readDataFromStreamHandler?(data)
            }
        default:
            break
        }
    }

    private func handleEventOnOutputStream(with eventCode: NSStreamEvent) {
        switch eventCode {
        case [.HasBytesAvailable]:
            break
        default:
            break
        }
    }
}
