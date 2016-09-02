//
//  Thali CordovaPlugin
//  AppContextTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import XCTest
import UIKit

class AppContextDelegateMock: NSObject, AppContextDelegate {
    var networkStatusUpdated = false
    var willEnterBackground = false
    var didEnterForeground = false

    @objc func context(context: AppContext, didResolveMultiConnectWith paramsJSONString: String) {}
    @objc func context(context: AppContext, didFailMultiConnectConnectionWith paramsJSONString: String) {}
    @objc func context(context: AppContext, didChangePeerAvailability peers: String) {}
    @objc func context(context: AppContext, didChangeNetworkStatus status: String) {
        networkStatusUpdated = true
    }
    @objc func context(context: AppContext, didUpdateDiscoveryAdvertisingState discoveryAdvertisingState: String) {}
    @objc func context(context: AppContext, didFailIncomingConnectionToPort port: UInt16) {}
    @objc func appWillEnterBackground(with context: AppContext) {
        willEnterBackground = true
    }
    @objc func appDidEnterForeground(with context: AppContext) {
        didEnterForeground = true
    }
}

class AppContextTests: XCTestCase {
    var context: AppContext! = nil

    override func setUp() {
        context = AppContext(serviceType: "thaliTest")
    }

    override func tearDown() {
        context = nil
    }

    func testUpdateNetworkStatus() {
        let delegateMock = AppContextDelegateMock()
        context.delegate = delegateMock
        let _ = try? context.didRegisterToNative([AppContextJSEvent.networkChanged, NSNull()])
        XCTAssertTrue(delegateMock.networkStatusUpdated, "network status is not updated")
    }

    func testWillEnterBackground() {
        let delegateMock = AppContextDelegateMock()
        context.delegate = delegateMock
        NSNotificationCenter.defaultCenter().postNotificationName(UIApplicationWillResignActiveNotification, object: nil)
        XCTAssertTrue(delegateMock.willEnterBackground)
    }

    func testDidEnterForeground() {
        let delegateMock = AppContextDelegateMock()
        context.delegate = delegateMock
        NSNotificationCenter.defaultCenter().postNotificationName(UIApplicationDidBecomeActiveNotification, object: nil)
        XCTAssertTrue(delegateMock.didEnterForeground)
    }

    func testDidRegisterToNative() {
        var error: ErrorType?
        do {
            try context.didRegisterToNative(["test", "test"])
        } catch let err {
            error = err
        }
        XCTAssertNil(error)
        var contextError: AppContextError?
        do {
            try context.didRegisterToNative(["test"])
        } catch let err as AppContextError{
            contextError = err
        } catch _ {
        }
        XCTAssertEqual(contextError, .BadParameters)
    }

    func testGetIOSVersion() {
        XCTAssertEqual(NSProcessInfo().operatingSystemVersionString, context.getIOSVersion())
    }

    func testMultiConnectErrors() {
        var error: AppContextError?
        do {
            try context.multiConnectToPeer([""])
        } catch let err as AppContextError {
            error = err
        } catch _ {}
        XCTAssertEqual(error, AppContextError.BadParameters)
    }

    func testErrorDescription() {
        enum StringConvertibleError: ErrorType, CustomStringConvertible {
            case TestError

            var description: String {
                return "test_description"
            }
        }
        XCTAssertEqual(StringConvertibleError.TestError.description, errorDescription(StringConvertibleError.TestError))

        let unknownError = AppContextError.UnknownError
        XCTAssertEqual((unknownError as NSError).localizedDescription, errorDescription(unknownError))
    }

    func testJsonValue() {
        var jsonDict: [String : AnyObject] = ["number" : 4.2]
        var jsonString = "{\"number\":4.2}"
        XCTAssertEqual(jsonValue(jsonDict), jsonString)
        jsonDict = ["string" : "42"]
        jsonString = "{\"string\":\"42\"}"
        XCTAssertEqual(jsonValue(jsonDict), jsonString)
        jsonDict = ["null" : NSNull()]
        jsonString = "{\"null\":null}"
        XCTAssertEqual(jsonValue(jsonDict), jsonString)
        jsonDict = ["bool" : true]
        jsonString = "{\"bool\":true}"
        XCTAssertEqual(jsonValue(jsonDict), jsonString)
    }
}
