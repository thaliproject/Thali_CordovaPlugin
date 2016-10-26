//
//  Thali CordovaPlugin
//  NSRunLoop+NSStreamEventsThread.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import Foundation

extension NSRunLoop {

    class func myRunLoop() -> NSRunLoop {
        return NSStreamEventsThread.sharedInstance.runLoop
    }
}
