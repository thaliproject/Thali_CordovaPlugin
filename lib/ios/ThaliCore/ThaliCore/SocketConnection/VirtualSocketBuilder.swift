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

  /**
   Represents non-TCP/IP session.
   */
  fileprivate let nonTCPsession: Session

  /**
   Represents object that provides write-only stream functionality.
   */
  fileprivate var outputStream: OutputStream?

  /**
   Represents object that provides read-only stream functionality.
   */
  fileprivate var inputStream: InputStream?

  // MARK: - Initialization

  /**
   Creates a new `VirtualSocketBuilder` object.

   - parameters:
     - nonTCPsession:
       Represents non-TCP/IP session.

   - returns:
     An initialized `VirtualSocketBuilder` object.
   */
  init(with nonTCPsession: Session) {
    self.nonTCPsession = nonTCPsession
  }
}

/**
 Creates `VirtualSocket` on `BrowserRelay` if possible.
 */
final class BrowserVirtualSocketBuilder: VirtualSocketBuilder {

  // MARK: - Internal state

  /**
   An unique string that identifies `VirtualSocket` object.

   Both *inputStream* and *outputStream* have the same *streamName*.
   */
  internal fileprivate(set) var streamName: String

  // MARK: - Private state

  /**
   Timeout to receive *inputStream* back.
   */
  fileprivate let streamReceivedBackTimeout: TimeInterval

  /**
   Called when creation of VirtualSocket is completed.

   It has 2 arguments: `VirtualSocket?` and `Error?`.

   If we're passing `Error` then something went wrong and `VirtualSocket` should be nil.
   Otherwise `Error` should be nil.
   */
  fileprivate var completion: ((VirtualSocket?, Error?) -> Void)?

  /**
   Bool flag indicates if we received *inputStream*.
   */
  fileprivate var streamReceivedBack = Atomic(false)

  // MARK: - Initialization

  /**
   Creates a new `BrowserVirtualSocketBuilder` object.

   - parameters:
     - nonTCPsession:
       Represents non-TCP/IP session.

     - streamName:
       Name of new stream.

     - streamReceivedBackTimeout:
       Timeout to receive *inputStream* back.

   - returns:
     An initialized `BrowserVirtualSocketBuilder` object.
   */
  init(with nonTCPsession: Session, streamName: String, streamReceivedBackTimeout: TimeInterval) {
    self.streamName = streamName
    self.streamReceivedBackTimeout = streamReceivedBackTimeout
    super.init(with: nonTCPsession)
  }

  // MARK: - Internal methods

  /**
   This method is trying to start new *outputStream* with fresh generated name
   and then waiting for inputStream from remote peer for *streamReceivedBackTimeout*.
   */
  func startBuilding(with completion: @escaping (VirtualSocket?, Error?) -> Void) {
    self.completion = completion

    do {
      let outputStream = try nonTCPsession.startOutputStream(with: streamName)
      self.outputStream = outputStream

      let streamReceivedBackTimeout = DispatchTime.now() +
        Double(Int64(self.streamReceivedBackTimeout * Double(NSEC_PER_SEC))) /
        Double(NSEC_PER_SEC)
      DispatchQueue.main.asyncAfter(deadline: streamReceivedBackTimeout) {
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

  /**
   We're calling this method when we have inputStream from remote peer.

   It creates new `VirtualSocket` object asynchronously.

   - parameters:
     - inputStream:
       *inputStream* object.
   */
  func completeVirtualSocket(with inputStream: InputStream) {

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

  /**
   Called when creation of VirtualSocket is completed.

   It has 2 arguments: `VirtualSocket?` and `Error?`.

   If we're passing `Error` then something went wrong and `VirtualSocket` should be nil.
   Otherwise `Error` should be nil.
   */
  fileprivate var completion: (VirtualSocket?, Error?) -> Void

  // MARK: - Initialization

  /**
   Returns new `AdvertiserVirtualSocketBuilder` object.

   - parameters:
     - nonTCPsession:
       non-TCP/IP session that will be used for communication among peers via `VirtualSocket`.

     - completion:
       Called when creation of VirtualSocket is completed.

   - returns:
     An initialized `AdvertiserVirtualSocketBuilder` object.
   */
  required init(with nonTCPsession: Session,
                completion: @escaping ((VirtualSocket?, Error?) -> Void)) {
    self.completion = completion
    super.init(with: nonTCPsession)
  }

  // MARK: - Internal methods

  /**
   Creates new `VirtualSocket` object asynchronously.

   Method is trying to start new *outputStream* using the exact same name as the *inputStream*.
   If succeeded then *completion* is called and `VirtualSocket` passed as a parameter,
   otherwise *completion* is called with nil argument and error passed.

   - parameters:
     - inputStream:
       inputStream object that will be used in new `VirtualSocket`.

     - inputStreamName:
       Name of *inputStream*. It will be used to start new *outputStream*.
   */
  func createVirtualSocket(with inputStream: InputStream, inputStreamName: String) {
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
