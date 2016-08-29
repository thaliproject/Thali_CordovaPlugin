//
//  Thali CordovaPlugin
//  AppContextTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import XCTest
import ThaliCore

class AppContextTests: XCTestCase {
    var context: AppContext! = nil
    var expectation: XCTestExpectation?
    
    override func setUp() {
        context = AppContext(serviceType: "thaliTest")
    }
    
    override func tearDown() {
        context = nil
    }
    
    func testUpdateNetworkStatus() {
        
        class AppContextDelegateMock: NSObject, AppContextDelegate {
            var networkStatus: String?
            var networkStatusUpdated = false
            @objc func context(context: AppContext, didChangePeerAvailability peers: String) {}
            @objc func context(context: AppContext, didChangeNetworkStatus status: String) {
                networkStatusUpdated = true
                networkStatus = status
            }
            @objc func context(context: AppContext, didUpdateDiscoveryAdvertisingState discoveryAdvertisingState: String) {}
            @objc func context(context: AppContext, didFailIncomingConnectionToPort port: UInt16) {}
            @objc func appWillEnterBackground(withContext context: AppContext) {}
            @objc func appDidEnterForeground(withContext context: AppContext) {}
        }
        
        let delegateMock = AppContextDelegateMock()
        context.delegate = delegateMock
        let _ = try? context.didRegisterToNative([AppContextJSEvent.networkChanged, NSNull()])
        XCTAssertTrue(delegateMock.networkStatusUpdated, "network status is not updated")
        
        let expectedParameters = [
            "bluetooth",
            "bluetoothLowEnergy",
            "wifi",
            "cellular",
            "bssid"
        ]
        
        
        if let dictinaryNetworkStatus = dictionaryValue(delegateMock.networkStatus!) {
            XCTAssertEqual(dictinaryNetworkStatus.count, expectedParameters.count, "Wrong amount of parameters in network status")
            
            for expectedParameter in expectedParameters {
                XCTAssertNotNil(dictinaryNetworkStatus[expectedParameter], "Network status doesn't contain \(expectedParameter) parameter")
            }
        } else {
            XCTFail("Can not convert network status JSON string to dictionary")
        }
        
        
        var bluetoothStateActual: String!
        var bluetoothLowEnergyStateActual: String!
        var wifiStateActual: String!
        var cellularStateActual: String!
        var bluetoothStateExpected: String!
        var bluetoothLowEnergyStateExpected: String!
        var wifiStateExpected: String!
        var cellularStateExpected: String!
        
        BluetoothHardwareControlManager.sharedInstance().registerObserver(self)
        NSThread.sleepForTimeInterval(1)
        
        // Push hardware state
        let bluetoothIsPoweredBeforeTest = BluetoothHardwareControlManager.sharedInstance().bluetoothIsPowered()
        
        //TODO: turn bluetooth (and BLE) on and check status
        if !bluetoothIsPoweredBeforeTest {
            expectation = expectationWithDescription("Bluetooth turned on")
            
            BluetoothHardwareControlManager.sharedInstance().turnBluetoothOn()
            
            waitForExpectationsWithTimeout(10, handler: { error in
                XCTAssertNotNil(error, "Can not turn on bluetooth hardware")
            })
        }
        
        let _ = try? context.didRegisterToNative([AppContextJSEvent.networkChanged, NSNull()])
        NSThread.sleepForTimeInterval(1)
        
        if let dictinaryNetworkStatus = dictionaryValue(delegateMock.networkStatus!) {
            bluetoothStateExpected = "on"
            bluetoothLowEnergyStateExpected = "on"
            bluetoothStateActual = dictinaryNetworkStatus["bluetooth"] as! String
            bluetoothLowEnergyStateActual = dictinaryNetworkStatus["bluetoothLowEnergy"] as! String
            XCTAssertEqual(bluetoothStateActual, bluetoothStateExpected, "Wrong bluetooth state (expected: \(bluetoothStateExpected), real: \(bluetoothStateActual))")
            XCTAssertEqual(bluetoothLowEnergyStateActual, bluetoothLowEnergyStateExpected, "Wrong bluetoothLowEnergyState state (expected: on, real: \(bluetoothLowEnergyStateActual))")
        } else {
            XCTFail("Can not convert network status JSON string to dictionary")
        }
        
        
        //TODO: turn bluetooth (and BLE) off and check status
        expectation = expectationWithDescription("Bluetooth turned off")
        
        BluetoothHardwareControlManager.sharedInstance().turnBluetoothOff()
        
        waitForExpectationsWithTimeout(10, handler: { error in
            XCTAssertNotNil(error, "Can not turn off bluetooth hardware")
        })
        
        
        let _ = try? context.didRegisterToNative([AppContextJSEvent.networkChanged, NSNull()])
        NSThread.sleepForTimeInterval(1)
        
        if let dictinaryNetworkStatus = dictionaryValue(delegateMock.networkStatus!) {
            bluetoothStateExpected = "off"
            bluetoothLowEnergyStateExpected = "off"
            bluetoothStateActual = dictinaryNetworkStatus["bluetooth"] as! String
            bluetoothLowEnergyStateActual = dictinaryNetworkStatus["bluetoothLowEnergy"] as! String
            XCTAssertEqual(bluetoothStateActual, bluetoothStateExpected, "Wrong bluetooth state (expected: \(bluetoothStateExpected), real: \(bluetoothStateActual))")
            XCTAssertEqual(bluetoothLowEnergyStateActual, bluetoothLowEnergyStateExpected, "Wrong bluetoothLowEnergyState state (expected: \(bluetoothLowEnergyStateExpected), real: \(bluetoothLowEnergyStateActual))")
            
        } else {
            XCTFail("Can not convert network status JSON string to dictionary")
        }
        
        
        // Restore hardware state
        bluetoothIsPoweredBeforeTest
            ? BluetoothHardwareControlManager.sharedInstance().turnBluetoothOn()
            : BluetoothHardwareControlManager.sharedInstance().turnBluetoothOff()
        
        
        //        //TODO: turn wifi on and check status
        //        wifiStateExpected = "on"
        //        wifiStateActual = delegateMock.networkStatus!["wifi"]
        //        XCTAssertEqual(wifiStateActual, wifiStateExpected, "Wrong wifi state (expected: \(wifiStateExpected), real: \(wifiStateActual))")
        //
        //
        //        //TODO: turn wifi off and check status
        //        wifiStateExpected = "off"
        //        wifiStateActual = delegateMock.networkStatus!["wifi"]
        //        XCTAssertEqual(wifiStateActual, wifiStateExpected, "Wrong wifi state (expected: \(wifiStateExpected), real: \(wifiStateActual))")
        
        
        if let dictinaryNetworkStatus = dictionaryValue(delegateMock.networkStatus!) {
            //TODO: check cellular in status
            cellularStateExpected = "doNotCare"
            cellularStateActual = dictinaryNetworkStatus["cellular"] as! String
            XCTAssertEqual(cellularStateActual, cellularStateExpected, "Wrong cellular state (expected: \(cellularStateExpected), real: \(cellularStateActual))")
        } else {
            XCTFail("Can not convert network status JSON string to dictionary")
        }
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
}

extension AppContextTests : BluetoothHardwareControlObserverProtocol {
    func receivedBluetoothNotification(btNotification: BluetoothHardwareControlNotification) {
        if btNotification == PowerChangedNotification {
            expectation?.fulfill()
        }
    }
}
