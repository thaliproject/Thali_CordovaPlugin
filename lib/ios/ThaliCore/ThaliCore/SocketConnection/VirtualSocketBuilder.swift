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
    let session: Session

    // MARK: - Private state
    private let socketCompletionHandler: ((NSInputStream, NSOutputStream)?, ErrorType?) -> Void
    private let streamReceiveTimeout: NSTimeInterval


    required init(session: Session,
                  streamReceiveTimeout: NSTimeInterval,
                  completionHandler: ((inputStream: NSInputStream, outputStream: NSOutputStream)?,
                                      ErrorType?) -> Void) {

        self.session = session
        self.streamReceiveTimeout = streamReceiveTimeout
        self.socketCompletionHandler = completionHandler
    }
}

final class BrowserVirtualSocketBuilder: VirtualSocketBuilder {

    required init(session: Session,
                  streamReceiveTimeout: NSTimeInterval,
                  completionHandler: ((NSInputStream, NSOutputStream)?, ErrorType?) -> Void) {

        super.init(session: session,
                   streamReceiveTimeout: streamReceiveTimeout,
                   completionHandler: completionHandler)

        do {
            let outputStreamName = NSUUID().UUIDString

            let outputStream = try session.createOutputStream(with: outputStreamName)
            session.didReceiveInputStreamHandler = {
                inputStream, inputStreamName in

                guard inputStreamName == outputStreamName else {
                    completionHandler(nil, ThaliCoreError.ConnectionFailed)
                    return
                }
                completionHandler((inputStream, outputStream), nil)
            }

            let delayTime = dispatch_time(DISPATCH_TIME_NOW,
                                          Int64(streamReceiveTimeout * Double(NSEC_PER_SEC)))
            dispatch_after(delayTime, dispatch_get_main_queue()) {
                [weak self] in

                guard let strongSelf = self else {
                    return
                }

                strongSelf.session.didReceiveInputStreamHandler = nil
                strongSelf.session.disconnect()
                completionHandler(nil, ThaliCoreError.ConnectionTimedOut)
            }
        } catch let error {
            completionHandler(nil, error)
        }
    }
}

final class AdvertiserVirtualSocketBuilder: VirtualSocketBuilder {

    required init(session: Session,
                  streamReceiveTimeout: NSTimeInterval,
                  completionHandler: ((NSInputStream, NSOutputStream)?, ErrorType?) -> Void) {
        super.init(session: session,
                   streamReceiveTimeout: streamReceiveTimeout,
                   completionHandler: completionHandler)

        self.session.didReceiveInputStreamHandler = {
            inputStream, inputStreamName in

            do {
                let outputStream = try session.createOutputStream(with: inputStreamName)
                completionHandler((inputStream, outputStream), nil)
            } catch let error {
                completionHandler(nil, error)
            }
        }
    }
}
