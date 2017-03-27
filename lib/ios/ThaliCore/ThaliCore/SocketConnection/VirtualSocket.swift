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
  internal fileprivate(set) var opened = false
  internal var didOpenVirtualSocketHandler: ((VirtualSocket) -> Void)?
  internal var didReadDataFromStreamHandler: ((VirtualSocket, Data) -> Void)?
  internal var didCloseVirtualSocketHandler: ((VirtualSocket) -> Void)?

  // MARK: - Private state
  fileprivate var inputStream: InputStream
  fileprivate var outputStream: OutputStream

  fileprivate var inputStreamOpened = false
  fileprivate var outputStreamOpened = false

  let maxReadBufferLength = 1024
  fileprivate var pendingDataToWrite: NSMutableData?

  // MARK: - Initialize
  init(with inputStream: InputStream, outputStream: OutputStream) {
    self.inputStream = inputStream
    self.outputStream = outputStream
    super.init()
  }

  // MARK: - Internal methods
  func openStreams() {
    if !opened {
      opened = true
      let queue = DispatchQueue.global(priority: DispatchQueue.GlobalQueuePriority.default)
      queue.async(execute: {
        self.inputStream.delegate = self
        self.inputStream.schedule(in: RunLoop.current,
          forMode: RunLoopMode.defaultRunLoopMode)
        self.inputStream.open()

        self.outputStream.delegate = self
        self.outputStream.schedule(in: RunLoop.current,
          forMode: RunLoopMode.defaultRunLoopMode)
        self.outputStream.open()

        RunLoop.current.run(until: Date.distantFuture)
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

  func writeDataToOutputStream(_ data: Data) {

    if !outputStream.hasSpaceAvailable {
      pendingDataToWrite?.append(data)
      return
    }

    let dataLength = data.count
    let buffer: [UInt8] = Array(
      UnsafeBufferPointer(start: (data as NSData).bytes.bindMemory(to: UInt8.self, capacity: data.count),
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
    writeDataToOutputStream(dataToWrite as Data)
  }

  fileprivate func readDataFromInputStream() {
    var buffer = [UInt8](repeating: 0, count: maxReadBufferLength)

    let bytesReaded = self.inputStream.read(&buffer, maxLength: maxReadBufferLength)
    if bytesReaded >= 0 {
      let data = Data(bytes: buffer, count: bytesReaded)
      didReadDataFromStreamHandler?(self, data)
    } else {
      closeStreams()
    }
  }
}

// MARK: - NSStreamDelegate - Handling stream events
extension VirtualSocket: StreamDelegate {

  // MARK: - Delegate methods
  internal func stream(_ aStream: Stream, handle eventCode: Stream.Event) {

    if aStream == self.inputStream {
      handleEventOnInputStream(eventCode)
    } else if aStream == self.outputStream {
      handleEventOnOutputStream(eventCode)
    } else {
      assertionFailure()
    }
  }

  fileprivate func handleEventOnInputStream(_ eventCode: Stream.Event) {
    switch eventCode {
    case Stream.Event.openCompleted:
      inputStreamOpened = true
      didOpenStreamHandler()
    case Stream.Event.hasBytesAvailable:
      readDataFromInputStream()
    case Stream.Event.hasSpaceAvailable:
      closeStreams()
    case Stream.Event.errorOccurred:
      closeStreams()
    case Stream.Event.endEncountered:
      closeStreams()
    default:
      break
    }
  }

  fileprivate func handleEventOnOutputStream(_ eventCode: Stream.Event) {
    switch eventCode {
    case Stream.Event.openCompleted:
      outputStreamOpened = true
      didOpenStreamHandler()
    case Stream.Event.hasBytesAvailable:
      readDataFromInputStream()
    case Stream.Event.hasSpaceAvailable:
      writePendingData()
    case Stream.Event.errorOccurred:
      closeStreams()
    case Stream.Event.endEncountered:
      closeStreams()
    default:
      break
    }
  }

  fileprivate func didOpenStreamHandler() {
    if inputStreamOpened && outputStreamOpened {
      didOpenVirtualSocketHandler?(self)
    }
  }
}
