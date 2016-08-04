//
//  The MIT License (MIT)
//
//  Copyright (c) 2016 Microsoft
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//  THE SOFTWARE.
//
//  Thali CordovaPlugin
//  AppContextTests.swift
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
