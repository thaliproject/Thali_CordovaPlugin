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

    private let completionHandler: ((NSOutputStream, NSInputStream)?, ErrorType?) -> Void
    let session: Session

    required init(session: Session,
                  completionHandler: ((NSOutputStream, NSInputStream)?, ErrorType?) -> Void) {

        self.session = session
        self.completionHandler = completionHandler
    }
}

final class BrowserVirtualSocketBuilder: VirtualSocketBuilder {

    required init(session: Session,
                  completionHandler: ((NSOutputStream, NSInputStream)?, ErrorType?) -> Void) {
        super.init(session: session, completionHandler: completionHandler)

        let createSocket = {
            do {
                let streamName = NSUUID().UUIDString
                let outputStream = try session.createOutputStream(withName: streamName)
                session.didReceiveInputStreamHandler = { inputStream, name in
                    guard name == streamName else {
                        completionHandler(nil, MultiConnectError.ConnectionFailed)
                        return
                    }
                    completionHandler((outputStream, inputStream), nil)
                }
            } catch let error {
                completionHandler(nil, error)
            }
        }

        session.sessionState.withValue { [unowned session] value in
            if value == .Connected {
                createSocket()
            } else {
                session.sessionStateChangesHandler = { state in
                    if state == .Connected {
                        createSocket()
                    }
                }
            }
        }
    }
}

final class AdvertiserVirtualSocketBuilder: VirtualSocketBuilder {

    required init(session: Session,
                  completionHandler: ((NSOutputStream, NSInputStream)?, ErrorType?) -> Void) {
        super.init(session: session, completionHandler: completionHandler)

        self.session.didReceiveInputStreamHandler = { inputStream, name in
            do {
                let outputStream = try session.createOutputStream(withName: name)
                completionHandler((outputStream, inputStream), nil)
            } catch let error {
                completionHandler(nil, error)
            }
        }
    }
}
