//
//  Thali CordovaPlugin
//  VirtualSocketBuilder.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license
//  information.
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
        let streamName = NSUUID().UUIDString
        session.createOutputStream(withName: streamName) { outputStream, error in
            guard let outputStream = outputStream where error == nil else {
                completionHandler(nil, error)
                return
            }
            session.getInputStream() { inputStream, name in
                guard name == streamName else {
                    completionHandler(nil, MultiConnectError.ConnectionFailed)
                    return
                }
                completionHandler((outputStream, inputStream), nil)
            }
        }
    }
}

final class AdvertiserVirtualSocketBuilder: VirtualSocketBuilder {
    required init(session: Session,
                  completionHandler: ((NSOutputStream, NSInputStream)?, ErrorType?) -> Void) {
        super.init(session: session, completionHandler: completionHandler)
        session.getInputStream() { inputStream, name in
            session.createOutputStream(withName: name) { outputStream, error in
                guard let outputStream = outputStream where error == nil else {
                    completionHandler(nil, error)
                    return
                }
                completionHandler((outputStream, inputStream), nil)
            }
        }
    }
}
