//
//  Thali CordovaPlugin
//  VirtualSocketBuilder.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import Foundation

class VirtualSocketBuilder {

    // MARK: - Public state
    let nonTCPsession: Session

    // MARK: - Private state
    private let streamReceivedBackTimeout: NSTimeInterval

    required init(with nonTCPsession: Session,
                       streamReceivedBackTimeout: NSTimeInterval,
                       completion: ((inputStream: NSInputStream, outputStream: NSOutputStream)?,
                                    ErrorType?)
                       -> Void) {

        self.nonTCPsession = nonTCPsession
        self.streamReceivedBackTimeout = streamReceivedBackTimeout
    }
}

final class BrowserVirtualSocketBuilder: VirtualSocketBuilder {

    required init(with nonTCPsession: Session,
                       streamReceivedBackTimeout: NSTimeInterval,
                       completion: ((NSInputStream, NSOutputStream)?, ErrorType?) -> Void) {

        super.init(with: nonTCPsession,
                   streamReceivedBackTimeout: streamReceivedBackTimeout,
                   completion: completion)

        do {
            let streamReceivedBack = Atomic(false)

            let outputStreamName = NSUUID().UUIDString
            let outputStream = try nonTCPsession.startOutputStream(with: outputStreamName)
            nonTCPsession.didReceiveInputStreamHandler = {
                inputStream, inputStreamName in

                guard inputStreamName == outputStreamName else {
                    completion(nil, ThaliCoreError.ConnectionFailed)
                    return
                }

                streamReceivedBack.modify { $0 = true }
                completion((inputStream, outputStream), nil)
            }

            let streamReceivedBackTimeout = dispatch_time(
                DISPATCH_TIME_NOW,
                Int64(streamReceivedBackTimeout * Double(NSEC_PER_SEC))
            )

            dispatch_after(streamReceivedBackTimeout, dispatch_get_main_queue()) {
                [weak self] in

                guard let strongSelf = self else {
                    return
                }

                streamReceivedBack.withValue {
                    if $0 == false {
                        strongSelf.nonTCPsession.didReceiveInputStreamHandler = nil
                    }
                }

                completion(nil, ThaliCoreError.ConnectionTimedOut)
            }
        } catch let error {
            completion(nil, error)
        }
    }
}

final class AdvertiserVirtualSocketBuilder: VirtualSocketBuilder {

    required init(with nonTCPsession: Session,
                       streamReceivedBackTimeout: NSTimeInterval,
                       completion: ((NSInputStream, NSOutputStream)?, ErrorType?) -> Void) {

        super.init(with: nonTCPsession,
                   streamReceivedBackTimeout: streamReceivedBackTimeout,
                   completion: completion)

        self.nonTCPsession.didReceiveInputStreamHandler = {
            inputStream, inputStreamName in

            do {
                let outputStream = try nonTCPsession.startOutputStream(with: inputStreamName)
                completion((inputStream, outputStream), nil)
            } catch let error {
                completion(nil, error)
            }
        }
    }
}
