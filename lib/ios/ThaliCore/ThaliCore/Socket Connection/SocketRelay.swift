//
//  Thali CordovaPlugin
//  SocketRelay.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation

class SocketRelay<Builder: VirtualSocketBuilder> {
    private var activeBuilders: [Session :Builder] = [:]
    private var activeSessions: [Session : (NSOutputStream, NSInputStream)] = [:]

    init() {}

    private func discard(builder: Builder) {
        synchronized(self) {
            let index = activeBuilders.indexOf {
                $0.1 === builder
            }
            guard let builderIndex = index else {
                return
            }
            activeBuilders.removeAtIndex(builderIndex)
        }
    }

    private func addToDiscardQueue(builder: Builder, for session: Session, withTimeout timeout: Double, completion: () -> Void) {
        let delayTime = dispatch_time(DISPATCH_TIME_NOW, Int64(timeout * Double(NSEC_PER_SEC)))
        dispatch_after(delayTime, dispatch_get_main_queue()) { [weak self] in
            guard let strongSelf = self else {
                return
            }
            synchronized(strongSelf) {
                strongSelf.discard(builder)
                if strongSelf.activeSessions[session] == nil {
                    completion()
                }
            }
        }
    }

    private func handleDidReceive(socket socket: (NSOutputStream, NSInputStream), for session: Session) {
        synchronized(self) {
            self.activeSessions[session] = socket
            self.activeSessions.removeValueForKey(session)
        }
    }

    func createSocket(with session: Session, onPort port: UInt16 = 0,
                           timeout: Double = 5, completion: (UInt16?, ErrorType?) -> Void) {
        let virtualSocketBuilder = Builder(session: session, completionHandler: { [weak self] socket, error in
            //todo bind to CocoaAsyncSocket and call completion block
            guard let socket = socket else {
                completion(nil, error)
                return
            }
            self?.handleDidReceive(socket: socket, for: session)
            }, disconnectedHandler: {
                completion(nil, MultiConnectError.ConnectionFailed)
        })
        addToDiscardQueue(virtualSocketBuilder, for: session, withTimeout: timeout) {
            completion(nil, MultiConnectError.ConnectionTimedOut)
        }
    }
}
