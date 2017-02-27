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
  private var pendingDataToWrite: NSMutableData?

  // MARK: - Initialize
  init(with inputStream: NSInputStream, outputStream: NSOutputStream) {
    self.inputStream = inputStream
    self.outputStream = outputStream
    super.init()
  }

  // MARK: - Internal methods
  func openStreams() {
    if !opened {
      opened = true
      let queue = dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0)
      dispatch_async(queue, {
        self.inputStream.delegate = self
        self.inputStream.scheduleInRunLoop(NSRunLoop.currentRunLoop(),
          forMode: NSDefaultRunLoopMode)
        self.inputStream.open()

        self.outputStream.delegate = self
        self.outputStream.scheduleInRunLoop(NSRunLoop.currentRunLoop(),
          forMode: NSDefaultRunLoopMode)
        self.outputStream.open()

        NSRunLoop.currentRunLoop().runUntilDate(NSDate.distantFuture())
      })
    }
  }

  func closeStreams() {
    if opened {
      opened = false

      inputStream.close()
      inputStreamOpened = false

      outputStream.close()
      outputStreamOpened = false

      didCloseVirtualSocketHandler?(self)
    }
  }

  func writeDataToOutputStream(data: NSData) {

    if !outputStream.hasSpaceAvailable {
      pendingDataToWrite?.appendData(data)
      return
    }

    let dataLength = data.length
    let buffer: [UInt8] = Array(
      UnsafeBufferPointer(start: UnsafePointer<UInt8>(data.bytes),
        count: dataLength)
    )

    let bytesWritten = outputStream.write(buffer, maxLength: dataLength)
    if bytesWritten < 0 {
      closeStreams()
    }
  }

  func writePendingData() {
    guard let dataToWrite = pendingDataToWrite else {
      return
    }

    pendingDataToWrite = nil
    writeDataToOutputStream(dataToWrite)
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

  private func handleEventOnInputStream(eventCode: NSStreamEvent) {
    switch eventCode {
    case NSStreamEvent.OpenCompleted:
      inputStreamOpened = true
      didOpenStreamHandler()
    case NSStreamEvent.HasBytesAvailable:
      readDataFromInputStream()
    case NSStreamEvent.HasSpaceAvailable:
      closeStreams()
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
      readDataFromInputStream()
    case NSStreamEvent.HasSpaceAvailable:
      writePendingData()
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
