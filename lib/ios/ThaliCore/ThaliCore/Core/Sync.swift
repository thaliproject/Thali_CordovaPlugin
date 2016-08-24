//
//  Thali CordovaPlugin
//  Sync.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation

func synchronized<T>(lock: AnyObject, @noescape closure: () -> T) -> T {
    objc_sync_enter(lock)
    defer { objc_sync_exit(lock) }
    let res = closure()
    return res
}
