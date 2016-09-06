//
//  Thali CordovaPlugin
//  SocketRelay.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license
//  information.
//

import Foundation

final class SocketRelay<Builder: VirtualSocketBuilder> {
    private var activeBuilders: Atomic<[Session : Builder]> = Atomic([:])
    private var activeSessions: Atomic<[Session : (NSOutputStream, NSInputStream)]> = Atomic([:])
    private let createSocketTimeout: Double

    init(createSocketTimeout: Double) {
        self.createSocketTimeout = createSocketTimeout
    }

    private func discard(builder: Builder) {
        activeBuilders.modify {
            let index = $0.indexOf {
                $0.1 === builder
            }
            guard let builderIndex = index else {
                return
            }
            $0.removeAtIndex(builderIndex)
        }
    }

    private func addToDiscardQueue(builder: Builder, for session: Session, completion: () -> Void) {
        let delayTime = dispatch_time(DISPATCH_TIME_NOW,
                Int64(self.createSocketTimeout * Double(NSEC_PER_SEC)))
        dispatch_after(delayTime, dispatch_get_main_queue()) { [weak self] in
            guard let strongSelf = self else {
                return
            }
            strongSelf.discard(builder)
            strongSelf.activeSessions.withValue {
                if $0[session] == nil {
                    completion()
                }
            }
        }
    }

    private func handleDidReceive(socket socket: (NSOutputStream, NSInputStream),
                                  for session: Session) {
        activeSessions.modify {
            $0[session] = socket
        }
        //todo bind to CocoaAsyncSocket and call completion block
        //https://github.com/thaliproject/Thali_CordovaPlugin/issues/881
    }

    func createSocket(with session: Session, onPort port: UInt16 = 0,
                           completion: (UInt16?, ErrorType?) -> Void) {
        let virtualSocketBuilder = Builder(session: session) { [weak self] socket, error in
            guard let socket = socket else {
                completion(nil, error)
                return
            }
            self?.handleDidReceive(socket: socket, for: session)
        }
        addToDiscardQueue(virtualSocketBuilder, for: session) {
            completion(nil, MultiConnectError.ConnectionTimedOut)
        }
    }
}
