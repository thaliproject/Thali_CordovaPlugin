//
//  Thali CordovaPlugin
//  AppContextTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import XCTest

class AppContextTests: XCTestCase {
    func testUpdateNetworkStatus() {
        
        class AppContextDelegateMock: NSObject, AppContextDelegate {
            var networkStatus: [String : AnyObject]?
            var networkStatusUpdated = false
            @objc func context(context: AppContext, didChangePeerAvailability peers: Array<[String : AnyObject]>) {}
            @objc func context(context: AppContext, didChangeNetworkStatus status: [String : AnyObject]) {
                networkStatusUpdated = true
                networkStatus = status
            }
            @objc func context(context: AppContext, didUpdateDiscoveryAdvertisingState discoveryAdvertisingState: [String : AnyObject]) {}
            @objc func context(context: AppContext, didFailIncomingConnectionToPort port: UInt16) {}
            @objc func appWillEnterBackground(withContext context: AppContext) {}
            @objc func appDidEnterForeground(withContext context: AppContext) {}
        }

        let context = AppContext()
        let delegateMock = AppContextDelegateMock()
        context.delegate = delegateMock
        context.didRegisterToNative(AppContext.networkChanged())
        XCTAssertTrue(delegateMock.networkStatusUpdated, "network status is not updated")

        let expectedParameters = [
            "bluetooth",
            "bluetoothLowEnergy",
            "wifi",
            "cellular"
        ]

        XCTAssertEqual(delegateMock.networkStatus!.count, expectedParameters.count, "Wrong amount of parameters in network status")

        for expectedParameter in expectedParameters {
            XCTAssertNotNil(delegateMock.networkStatus![expectedParameter], "Network status doesn't contain \(expectedParameter) parameter")
        }
    }
}
