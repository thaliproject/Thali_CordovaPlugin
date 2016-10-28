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
    fileprivate let nonTCPsession: Session
    fileprivate var outputStream: OutputStream?
    fileprivate var inputStream: InputStream?

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
    internal fileprivate(set) var streamName: String

    // MARK: - Private state
    fileprivate let streamReceivedBackTimeout: TimeInterval
    fileprivate var completion: ((VirtualSocket?, Error?) -> Void)?
    fileprivate var streamReceivedBack = Atomic(false)

    // MARK: - Initialization
    init(with nonTCPsession: Session,
              streamName: String,
              streamReceivedBackTimeout: TimeInterval) {
        self.streamName = streamName
        self.streamReceivedBackTimeout = streamReceivedBackTimeout
        super.init(with: nonTCPsession)
    }

    // MARK: - Internal methods
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
    fileprivate var completion: (VirtualSocket?, Error?) -> Void

    // MARK: - Initialization
    required init(with nonTCPsession: Session,
                       completion: @escaping ((VirtualSocket?, Error?) -> Void)) {
        self.completion = completion
        super.init(with: nonTCPsession)
    }

    // MARK: - Internal methods
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
