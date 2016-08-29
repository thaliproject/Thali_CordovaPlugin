//
//  Thali CordovaPlugin
//  AppStateNotificationsManagerTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//


import XCTest
import ThaliCore

class AppStateNotificationsManagerTests: XCTestCase {

    override func setUp() {
        super.setUp()
    }

    override func tearDown() {
        super.tearDown()
    }

    func testWillEnterBackground() {
        var willEnterBackgroundCalled: Bool = false
        let c = ApplicationStateNotificationsManager()
        c.willEnterBackgroundHandler = {
            willEnterBackgroundCalled = true
        }
        NSNotificationCenter.defaultCenter().postNotificationName(UIApplicationWillResignActiveNotification, object: nil)
        XCTAssertTrue(willEnterBackgroundCalled)
    }

    func testDidEnterForeground() {
        var didEnterForegroundCalled: Bool = false
        let c = ApplicationStateNotificationsManager()
        c.didEnterForegroundHandler = {
            didEnterForegroundCalled = true
        }
        NSNotificationCenter.defaultCenter().postNotificationName(UIApplicationDidBecomeActiveNotification, object: nil)
        XCTAssertTrue(didEnterForegroundCalled)
    }
}
