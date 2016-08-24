//
//  Thali CordovaPlugin
//  AdvertiserSessionManager.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation

class SessionManagerType {
    private let session: Session
    init(session: Session) {
        self.session = session
        session.didReceiveInputStream = didReceiveInputStream
        session.sessionStateChangesHandler = sessionStateChanged
    }

    func didReceiveInputStream(stream: NSInputStream, name: String) {
    }

    func sessionStateChanged(state: Session.SessionState) {
        do {
            switch state {
            case .Connected:
                try session.createOutputStream(NSUUID().UUIDString)
            default:
                break
            }
        } catch let error {
            //todo throw error to the upper level
        }
    }
}

class AdvertiserSessionManager: SessionManagerType {
}
