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

    // MARK: - Public state
    var readDataFromStreamHandler: ((NSData) -> Void)?

    // MARK: - Internal state
    internal private(set) var inputStream: NSInputStream?
    internal private(set) var outputStream: NSOutputStream?

    // MARK: - Private state

    // MARK: - Public methods
    init(with inputStream: NSInputStream,
              outputStream: NSOutputStream) {
        self.inputStream = inputStream
        self.outputStream = outputStream
        super.init()
    }

    func open() {
        guard
            let inputStream = inputStream, outputStream = outputStream else {
            return
        }

        inputStream.delegate = self
        inputStream.scheduleInRunLoop(NSRunLoop.mainRunLoop(), forMode: NSDefaultRunLoopMode)
        inputStream.open()

        outputStream.delegate = self
        outputStream.scheduleInRunLoop(NSRunLoop.mainRunLoop(), forMode: NSDefaultRunLoopMode)
        outputStream.open()
    }

    func close() {
        guard
            let inputStream = inputStream, let outputStream = outputStream else {
            return
        }

        inputStream.close()
        inputStream.removeFromRunLoop(NSRunLoop.mainRunLoop(), forMode: NSDefaultRunLoopMode)
        self.inputStream = nil


        outputStream.close()
        outputStream.removeFromRunLoop(NSRunLoop.mainRunLoop(), forMode: NSDefaultRunLoopMode)
        self.outputStream = nil
    }
}

extension VirtualSocket: NSStreamDelegate {

    // MARK: - Delegate methods
    public func stream(aStream: NSStream, handleEvent eventCode: NSStreamEvent) {
        if aStream == self.inputStream {
            handleEventOnInputStreamWith(eventCode)
        } else if aStream == self.outputStream {
            handleEventOnOutputStreamWith(eventCode)
        }

    }

    // MARK: - Private Helpers
    private func handleEventOnInputStreamWith(eventCode: NSStreamEvent) {
        switch eventCode {
        case NSStreamEvent.HasBytesAvailable:
            let maxBufferLength = 1024
            var buffer = [UInt8](count: maxBufferLength, repeatedValue: 0)

            let bytesReaded = self.inputStream!.read(&buffer, maxLength: maxBufferLength)

            if bytesReaded >= 0 {
                let data = NSData(bytes: &buffer, length: bytesReaded)
                readDataFromStreamHandler?(data)
            }
        default:
            break
        }
    }

    private func handleEventOnOutputStreamWith(eventCode: NSStreamEvent) {
        switch eventCode {
        case NSStreamEvent.HasBytesAvailable:
            break
        default:
            break
        }
    }
}
