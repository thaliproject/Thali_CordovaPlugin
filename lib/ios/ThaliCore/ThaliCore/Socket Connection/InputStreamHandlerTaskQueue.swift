//
//  Thali CordovaPlugin
//  InputStreamHandlerTaskQueue.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license
//  information.
//

import Foundation

/// Managing async queues: inputStreams queue and inputStream's handlers queue
final class InputStreamHandlerTaskQueue {
    var streamPool: [(NSInputStream, String)] = []
    var streamHandlerPool: [(NSInputStream, String) -> Void] = []
    let serialQueue = dispatch_queue_create("org.thaliproject.InputStreamHandlerTaskQueue",
            DISPATCH_QUEUE_SERIAL)

    func add(inputStream: NSInputStream, withName name: String) {
        dispatch_async(serialQueue) { [weak self] in
            guard let strongSelf = self else {
                return
            }
            if let handler = strongSelf.streamHandlerPool.first {
                handler(inputStream, name)
                strongSelf.streamHandlerPool = Array(strongSelf.streamHandlerPool.dropFirst(1))
            } else {
                strongSelf.streamPool.append((inputStream, name))
            }

        }
    }

    func add(handler: (NSInputStream, String) -> Void) {
        dispatch_async(serialQueue) { [weak self] in
            guard let strongSelf = self else {
                return
            }
            if let (stream, name) = strongSelf.streamPool.first {
                handler(stream, name)
                strongSelf.streamPool = Array(strongSelf.streamPool.dropFirst(1))
            } else {
                strongSelf.streamHandlerPool.append(handler)
            }
        }
    }
}
