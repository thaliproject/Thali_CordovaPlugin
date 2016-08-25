//
//  Thali CordovaPlugin
//  SessionManager.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation

class SessionManager {
    private var outputStream: NSOutputStream? = nil
    private var inputStream: NSInputStream? = nil
    private let didCreateSocketHandler: (NSOutputStream, NSInputStream) -> Void
    private let disconnectedHandler: () -> Void
    let session: Session

    init(session: Session, didCreateSocketHandler: (NSOutputStream, NSInputStream) -> Void, disconnectedHandler: () -> Void) {
        self.session = session
        self.didCreateSocketHandler = didCreateSocketHandler
        self.disconnectedHandler = disconnectedHandler
        session.didReceiveInputStream = didReceive
        session.sessionStateChangesHandler = sessionStateChanged
    }

    func didReceive(inputStream: NSInputStream, name: String) {}
    
    func disconnect() {
        session.disconnect()
    }

    func sessionStateChanged(state: Session.SessionState) {
        switch state {
        case .NotConnected:
            disconnectedHandler()
        default:
            break
        }
    }
}

class BrowserSessionManager: SessionManager {
    private var outputStreamName: String? = nil

    override func didReceive(inputStream: NSInputStream, name: String) {
        guard let outputStreamName = outputStreamName where name == outputStreamName else {
            return
        }
        self.inputStream = inputStream
        didCreateSocketHandler(outputStream!, inputStream)
    }

    override func sessionStateChanged(state: Session.SessionState) {
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
            print(error)
        }
    }
}

class AdvertiserSessionManager: SessionManager {

    override func didReceive(inputStream: NSInputStream, name: String) {
        self.inputStream = inputStream
        do {
            guard session.sessionState == .Connected else {
                return
            }
            let outputStream = try session.createOutputStream(name)
            self.outputStream = outputStream
            didCreateSocketHandler(outputStream, inputStream)
        } catch let error {
            print(error)
        }
    }

    override func sessionStateChanged(state: Session.SessionState) {
        super.sessionStateChanged(state)
    }
}
