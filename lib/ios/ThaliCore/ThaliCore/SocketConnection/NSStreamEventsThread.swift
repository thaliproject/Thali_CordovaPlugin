//
//  Thali CordovaPlugin
//  NSStreamEventsThread.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import Foundation

class NSStreamEventsThread: Thread {

    private let runLoopReadyGroup: DispatchGroup
    private var _runLoop: RunLoop
    internal var runLoop: RunLoop {
        get {
            runLoopReadyGroup.wait(timeout: DispatchTime.distantFuture)
            return _runLoop
        }
    }

    static var sharedInstance: NSStreamEventsThread {

        struct Static {

            static var instance: NSStreamEventsThread? = nil
            static var thread: NSStreamEventsThread? = nil
        }

        Static.thread = NSStreamEventsThread()
        Static.thread?.name = "com.thaliproject.NSStreamEventsThread"
        Static.thread?.start()

        return  Static.thread!
    }

    override init() {
        _runLoop = RunLoop()
        runLoopReadyGroup = DispatchGroup()
        runLoopReadyGroup.enter()
    }

    override func main() {
        autoreleasepool {
            _runLoop = RunLoop.current
            runLoopReadyGroup.leave()

            // Prevent runloop from spinning
            var sourceCtx = CFRunLoopSourceContext(version: 0,
                                                   info: nil,
                                                   retain: nil,
                                                   release: nil,
                                                   copyDescription: nil,
                                                   equal: nil,
                                                   hash: nil,
                                                   schedule: nil,
                                                   cancel: nil,
                                                   perform: nil)

            let source = CFRunLoopSourceCreate(nil, 0, &sourceCtx)
            CFRunLoopAddSource(CFRunLoopGetCurrent(), source, CFRunLoopMode.defaultMode)

            while _runLoop.run(mode: RunLoopMode.defaultRunLoopMode, before: NSDate.distantFuture) {}
        }
    }
}
