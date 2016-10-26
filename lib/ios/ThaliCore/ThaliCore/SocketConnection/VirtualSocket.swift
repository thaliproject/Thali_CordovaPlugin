//
//  Thali CordovaPlugin
//  VirtualSocket.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

/**
 `VirtualSocket` class manages non-TCP virtual socket.

 Non-TCP virtual socket is a combination of the non-TCP output and input streams
 */
class VirtualSocket: NSObject {

    // MARK: - Internal state
    internal private(set) var opened = false
    internal var didOpenVirtualSocketHandler: ((VirtualSocket) -> Void)?
    internal var didReadDataFromStreamHandler: ((VirtualSocket, NSData) -> Void)?
    internal var didCloseVirtualSocketHandler: ((VirtualSocket) -> Void)?

    // MARK: - Private state
    private var inputStream: NSInputStream
    private var outputStream: NSOutputStream

    private var inputStreamOpened = false
    private var outputStreamOpened = false

    let maxReadBufferLength = 1024
    let maxDataToWriteLength = 1024

    private var bufferToWrite: Atomic<NSMutableData>

    private let _workQueue: dispatch_queue_t

    // MARK: - Initialize
    init(with inputStream: NSInputStream, outputStream: NSOutputStream) {
        self.inputStream = inputStream
        self.outputStream = outputStream
        bufferToWrite = Atomic(NSMutableData())
        _workQueue = dispatch_queue_create(nil, DISPATCH_QUEUE_SERIAL)
        super.init()
    }

    // MARK: - Internal methods
    func openStreams() {
        if !opened {
            opened = true

            dispatch_async(_workQueue, {
                self.inputStream.delegate = self
                self.inputStream.scheduleInRunLoop(NSRunLoop.myRunLoop(),
                                                   forMode: NSDefaultRunLoopMode)
                self.inputStream.open()

                self.outputStream.delegate = self
                self.outputStream.scheduleInRunLoop(NSRunLoop.myRunLoop(),
                                                    forMode: NSDefaultRunLoopMode)
                self.outputStream.open()
            })
        }
    }

    func closeStreams() {
        if opened {
            opened = false

            inputStream.delegate = nil

            inputStream.close()
            inputStreamOpened = false

            outputStream.delegate = nil

            outputStream.close()
            outputStreamOpened = false

            didCloseVirtualSocketHandler?(self)
        }
    }

    func writeDataToOutputStream(data: NSData) {
        self.bufferToWrite.modify {
            $0.appendData(data)
        }

        dispatch_async(_workQueue, {
            self.writePendingDataFromBuffer()
        })
    }

    // MARK: - Private methods
    @objc private func writePendingDataFromBuffer() {
        let bufferLength = bufferToWrite.value.length

        guard bufferLength > 0 else {
            return
        }

        let dataToBeWrittenLength = min(bufferLength, maxDataToWriteLength)

        var buffer = [UInt8](count: dataToBeWrittenLength, repeatedValue: 0)
        bufferToWrite.value.getBytes(&buffer, length: dataToBeWrittenLength)

        let bytesWritten = outputStream.write(buffer, maxLength: dataToBeWrittenLength)

        if bytesWritten < 0 {
            closeStreams()
        } else if bytesWritten > 0 {
            let writtenBytesRange = NSRange(location: 0, length: bytesWritten)
            bufferToWrite.modify {
                $0.replaceBytesInRange(writtenBytesRange, withBytes: nil, length: 0)
            }
        }
    }

    private func readDataFromInputStream() {
        var buffer = [UInt8](count: maxReadBufferLength, repeatedValue: 0)

        let bytesReaded = self.inputStream.read(&buffer, maxLength: maxReadBufferLength)
        if bytesReaded >= 0 {
            let data = NSData(bytes: &buffer, length: bytesReaded)
            didReadDataFromStreamHandler?(self, data)
        } else {
            closeStreams()
        }
    }

    deinit {
        closeStreams()
    }
}

// MARK: - NSStreamDelegate - Handling stream events
extension VirtualSocket: NSStreamDelegate {

    // MARK: - Delegate methods
    internal func stream(aStream: NSStream, handleEvent eventCode: NSStreamEvent) {

        if aStream == self.inputStream {
            handleEventOnInputStream(eventCode)
        } else if aStream == self.outputStream {
            handleEventOnOutputStream(eventCode)
        } else {
            assertionFailure()
        }
    }

    // MARK: - Private helpers
    private func handleEventOnInputStream(eventCode: NSStreamEvent) {
        switch eventCode {
        case NSStreamEvent.OpenCompleted:
            inputStreamOpened = true
            didOpenStreamHandler()
        case NSStreamEvent.HasBytesAvailable:
            dispatch_async(_workQueue, {
                [weak self] in
                guard let strongSelf = self else { return }

                strongSelf.readDataFromInputStream()
            })
        case NSStreamEvent.HasSpaceAvailable:
            break
        case NSStreamEvent.ErrorOccurred:
            closeStreams()
        case NSStreamEvent.EndEncountered:
            closeStreams()
        default:
            break
        }
    }

    private func handleEventOnOutputStream(eventCode: NSStreamEvent) {
        switch eventCode {
        case NSStreamEvent.OpenCompleted:
            outputStreamOpened = true
            didOpenStreamHandler()
        case NSStreamEvent.HasBytesAvailable:
            break
        case NSStreamEvent.HasSpaceAvailable:
            dispatch_async(_workQueue, {
                [weak self] in
                guard let strongSelf = self else { return }

                strongSelf.writePendingDataFromBuffer()
            })
        case NSStreamEvent.ErrorOccurred:
            closeStreams()
        case NSStreamEvent.EndEncountered:
            closeStreams()
        default:
            break
        }
    }

    private func didOpenStreamHandler() {
        if inputStreamOpened && outputStreamOpened {
            didOpenVirtualSocketHandler?(self)
        }
    }
}
