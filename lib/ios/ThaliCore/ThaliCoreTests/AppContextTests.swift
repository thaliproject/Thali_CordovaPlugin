//
//  Thali CordovaPlugin
//  AppContextTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//


import XCTest
import ThaliCore

class ContextDelegateMock: NSObject, AppContextDelegate {
    var willEnterBackgroundCalled: Bool = false
    var didEnterForegroundCalled: Bool = false
    
    func peerAvailabilityChanged(peers: Array<[String : AnyObject]>, inContext context: AppContext) {
    }
    
    func networkStatusChanged(status: [String : AnyObject], inContext context: AppContext) {
    }
    
    func discoveryAdvertisingStateUpdate(discoveryAdvertisingState: [String : AnyObject], inContext context: AppContext) {
    }
    
    func incomingConnectionFailed(toPort port: UInt16, inContext: AppContext) {
    }
    
    func appWillEnterBackground(context: AppContext) {
        willEnterBackgroundCalled = true
    }
    
    func appDidEnterForeground(context: AppContext) {
        didEnterForegroundCalled = true
    }
}

class AppContextTests: XCTestCase {
    private var app: AppContext!

    override func setUp() {
        super.setUp()
        app = AppContext()
    }
    
    override func tearDown() {
        app = nil
        super.tearDown()
    }

    func testWillEnterBackground() {
        let delegate = ContextDelegateMock()
        app.delegate = delegate
        NSNotificationCenter.defaultCenter().postNotificationName(UIApplicationWillResignActiveNotification, object: nil)
        XCTAssertTrue(delegate.willEnterBackgroundCalled)
    }
    
    func testDidEnterForeground() {
        let delegate = ContextDelegateMock()
        app.delegate = delegate
        NSNotificationCenter.defaultCenter().postNotificationName(UIApplicationDidBecomeActiveNotification, object: nil)
        XCTAssertTrue(delegate.didEnterForegroundCalled)
    }
}
