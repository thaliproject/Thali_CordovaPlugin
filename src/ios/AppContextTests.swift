//
//  Thali CordovaPlugin
//  AppContextTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import XCTest

class AppContextDelegateMock: NSObject, AppContextDelegate {
    var networkStatusUpdated = false
    var advertisingListeningState = ""
    var willEnterBackground = false
    var didEnterForeground = false
    @objc func context(context: AppContext, didChangePeerAvailability peers: String) {}
    @objc func context(context: AppContext, didChangeNetworkStatus status: String) {
        networkStatusUpdated = true
    }
    @objc func context(context: AppContext, didUpdateDiscoveryAdvertisingState
        discoveryAdvertisingState: String) {
        advertisingListeningState = discoveryAdvertisingState
    }
    @objc func context(context: AppContext, didFailIncomingConnectionToPort port: UInt16) {}
    @objc func appWillEnterBackground(withContext context: AppContext) {}
    @objc func appDidEnterForeground(withContext context: AppContext) {}
}

class AppContextTests: XCTestCase {
    var context: AppContext! = nil

    override func setUp() {
        context = AppContext(serviceType: "thaliTest")
    }

    override func tearDown() {
        context = nil
    }

    private func jsonDicitonaryFrom(string: String) -> [String : AnyObject]? {
        guard let data = string.dataUsingEncoding(NSUTF8StringEncoding) else {
            return nil
        }
        return (try? NSJSONSerialization.JSONObjectWithData(data, options: [])) as? [String : AnyObject]
    }

    private func validateAdvertisingUpdate(jsonString: String, advertising: Bool, browsing: Bool) {
        let json = jsonDicitonaryFrom(jsonString)
        let listeningActive = (json?["discoveryActive"] as? Bool)
        let advertisingActive = (json?["advertisingActive"] as? Bool)
        print(advertisingActive)
        print(listeningActive)
        XCTAssertEqual(advertisingActive, advertising)
        XCTAssertEqual(listeningActive, browsing)
    }

    func testUpdateNetworkStatus() {
        let delegateMock = AppContextDelegateMock()
        context.delegate = delegateMock
        let _ = try? context.didRegisterToNative([AppContextJSEvent.networkChanged, NSNull()])
        XCTAssertTrue(delegateMock.networkStatusUpdated, "network status is not updated")
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
            let notAString = 42
            try context.didRegisterToNative([notAString])
        } catch let err as AppContextError{
            contextError = err
        } catch _ {
        }
        XCTAssertEqual(contextError, .BadParameters)
    }

    func testGetIOSVersion() {
        XCTAssertEqual(NSProcessInfo().operatingSystemVersionString, context.getIOSVersion())
    }

    func testListeningAdvertisingUpdateOnStartAdvertising() {
        let delegateMock = AppContextDelegateMock()
        context.delegate = delegateMock
        let port = 42
        let _ = try? context.startUpdateAdvertisingAndListening(withParameters: [port])
        validateAdvertisingUpdate(delegateMock.advertisingListeningState, advertising: true,
                                  browsing: false)
    }

    func testListeningAdvertisingUpdateOnStartListening() {
        let delegateMock = AppContextDelegateMock()
        context.delegate = delegateMock
        let _ = try? context.startListeningForAdvertisements()
        validateAdvertisingUpdate(delegateMock.advertisingListeningState, advertising: false,
                                  browsing: true)
    }
}
