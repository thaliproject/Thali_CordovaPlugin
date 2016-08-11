//
//  Thali CordovaPlugin
//  AppContext.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import XCTest

class AppContextTests: XCTestCase {
    func testUpdateNetworkStatus() {
        
        class AppContextDelegateMock: NSObject, AppContextDelegate {
            var networkStatusUpdated = false
            @objc func context(context: AppContext, didChangePeerAvailability peers: Array<[String : AnyObject]>) {}
            @objc func context(context: AppContext, didChangeNetworkStatus status: [String : AnyObject]) {
                networkStatusUpdated = true
            }
            @objc func context(context: AppContext, didUpdateDiscoveryAdvertisingState discoveryAdvertisingState: [String : AnyObject]) {}
            @objc func context(context: AppContext, didFailIncomingConnectionToPort port: UInt16) {}
            @objc func appWillEnterBackground(withContext context: AppContext) {}
            @objc func appDidEnterForeground(withContext context: AppContext) {}
        }

        let context = AppContext()
        let delegateMock = AppContextDelegateMock()
        context.delegate = delegateMock
        context.updateNetworkStatus()
        XCTAssertTrue(delegateMock.networkStatusUpdated, "network status is not updated")
    }
}
