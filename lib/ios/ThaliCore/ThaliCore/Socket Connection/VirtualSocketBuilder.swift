//
//  Thali CordovaPlugin
//  VirtualSocketBuilder.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation

class VirtualSocketBuilder {
    private var outputStream: NSOutputStream?
    private var inputStream: NSInputStream?
    private let completionHandler: ((NSOutputStream, NSInputStream)?, ErrorType?) -> Void
    private let disconnectedHandler: () -> Void
    let session: Session

    required init(session: Session, completionHandler: ((NSOutputStream, NSInputStream)?, ErrorType?) -> Void,
                  disconnectedHandler: () -> Void) {
        self.session = session
        self.completionHandler = completionHandler
        self.disconnectedHandler = disconnectedHandler
        session.didReceiveInputStream = didReceive
        session.sessionStateChangesHandler = sessionStateChanged
    }

    private func didReceive(inputStream: NSInputStream, name: String) {}

    private func sessionStateChanged(state: Session.SessionState) {
        switch state {
        case .NotConnected:
            disconnectedHandler()
        default:
            break
        }
    }
}

class BrowserVirtualSocketBuilder: VirtualSocketBuilder {
    private var outputStreamName: String? = nil

    override private func didReceive(inputStream: NSInputStream, name: String) {
        super.didReceive(inputStream, name: name)
        guard let outputStreamName = outputStreamName where name == outputStreamName else {
            return
        }
        self.inputStream = inputStream
        if let outputStream = outputStream {
            completionHandler((outputStream, inputStream), nil)
        }
    }

    override private func sessionStateChanged(state: Session.SessionState) {
        super.sessionStateChanged(state)
        do {
            switch state {
            case .Connected:
                let streamName = NSUUID().UUIDString
                outputStream = try session.createOutputStream(streamName)
                outputStreamName = streamName
            default:
                break
            }
        } catch let error {
            completionHandler(nil, error)
        }
    }
}

class AdvertiserVirtualSocketBuilder: VirtualSocketBuilder {

    override private func didReceive(inputStream: NSInputStream, name: String) {
        super.didReceive(inputStream, name: name)
        self.inputStream = inputStream
        do {
            guard session.sessionState == .Connected else {
                return
            }
            let outputStream = try session.createOutputStream(name)
            self.outputStream = outputStream
            completionHandler((outputStream, inputStream), nil)
        } catch let error {
            completionHandler(nil, error)
        }
    }

    override private func sessionStateChanged(state: Session.SessionState) {
        super.sessionStateChanged(state)
    }
}
