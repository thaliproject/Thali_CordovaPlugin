//
//  Thali CordovaPlugin
//  VirtualSocketBuilder.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

/**
 Base class for `BrowserVirtualSocketBuilder` and `AdvertiserVirtualSocketBuilder`
 */
class VirtualSocketBuilder {

  // MARK: - Private state
  private let nonTCPsession: Session
  private var outputStream: NSOutputStream?
  private var inputStream: NSInputStream?

  // MARK: - Initialization
  init(with nonTCPsession: Session) {
    self.nonTCPsession = nonTCPsession
  }
}

/**
 Creates `VirtualSocket` on `BrowserRelay` if possible.
 */
final class BrowserVirtualSocketBuilder: VirtualSocketBuilder {

  // MARK: - Internal state
  internal private(set) var streamName: String

  // MARK: - Private state
  private let streamReceivedBackTimeout: NSTimeInterval
  private var completion: ((VirtualSocket?, ErrorType?) -> Void)?
  private var streamReceivedBack = Atomic(false)

  // MARK: - Initialization
  init(with nonTCPsession: Session,
            streamName: String,
            streamReceivedBackTimeout: NSTimeInterval) {
    self.streamName = streamName
    self.streamReceivedBackTimeout = streamReceivedBackTimeout
    super.init(with: nonTCPsession)
  }

  // MARK: - Internal methods
  func startBuilding(with completion: (VirtualSocket?, ErrorType?) -> Void) {
    self.completion = completion

    do {
      let outputStream = try nonTCPsession.startOutputStream(with: streamName)
      self.outputStream = outputStream

      let streamReceivedBackTimeout = dispatch_time(
        DISPATCH_TIME_NOW,
        Int64(self.streamReceivedBackTimeout * Double(NSEC_PER_SEC))
      )
      dispatch_after(streamReceivedBackTimeout, dispatch_get_main_queue()) {
        [weak self] in
        guard let strongSelf = self else { return }

        if strongSelf.streamReceivedBack.value == false {
          strongSelf.completion?(nil, ThaliCoreError.ConnectionTimedOut)
          strongSelf.completion = nil
        }
      }
    } catch _ {
      self.completion?(nil, ThaliCoreError.ConnectionFailed)
    }
  }

  func completeVirtualSocket(with inputStream: NSInputStream) {

    streamReceivedBack.modify { $0 = true }

    guard let outputStream = outputStream else {
      completion?(nil, ThaliCoreError.ConnectionFailed)
      completion = nil
      return
    }

    let vs = VirtualSocket(with: inputStream, outputStream: outputStream)
    completion?(vs, nil)
    completion = nil
  }
}

/**
 Creates `VirtualSocket` on `AdvertiserRelay` if possible.
 */
final class AdvertiserVirtualSocketBuilder: VirtualSocketBuilder {

  // MARK: - Private state
  private var completion: (VirtualSocket?, ErrorType?) -> Void

  // MARK: - Initialization
  required init(with nonTCPsession: Session,
                     completion: ((VirtualSocket?, ErrorType?) -> Void)) {
    self.completion = completion
    super.init(with: nonTCPsession)
  }

  // MARK: - Internal methods
  func createVirtualSocket(with inputStream: NSInputStream, inputStreamName: String) {
    do {
      let outputStream = try nonTCPsession.startOutputStream(with: inputStreamName)
      let virtualNonTCPSocket = VirtualSocket(with: inputStream,
                                              outputStream: outputStream)
      completion(virtualNonTCPSocket, nil)
    } catch let error {
      completion(nil, error)
    }
  }
}
