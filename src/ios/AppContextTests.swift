//
//  Thali CordovaPlugin
//  AppContextTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import XCTest
import ThaliCore

// MARK: - Mock objects
class AppContextDelegateMock: NSObject, AppContextDelegate {
    var networkStatus: String?
    var networkStatusUpdated = false

    var bluetoothStateActual: String?
    var bluetoothLowEnergyStateActual: String?
    var wifiStateActual: String?
    var cellularStateActual: String?

    @objc func context(context: AppContext, didChangePeerAvailability peers: String) {}
    @objc func context(context: AppContext, didChangeNetworkStatus status: String) {
        networkStatusUpdated = true
        networkStatus = status

        if let dictinaryNetworkStatus = dictionaryValue(networkStatus!) {
            guard let bluetoothState = dictinaryNetworkStatus["bluetooth"] as? String else {
                XCTFail("Can't cast bluetooth status to String")
                return
            }

            guard let bluetoothLowEnergyState = dictinaryNetworkStatus["bluetoothLowEnergy"] as? String else {
                XCTFail("Can't cast bluetoothLowEnergy status to String")
                return
            }

            guard let wifiState = dictinaryNetworkStatus["wifi"] as? String else {
                XCTFail("Can't cast wifi status to String")
                return
            }

            guard let cellularState = dictinaryNetworkStatus["cellular"] as? String else {
                XCTFail("Can't cast cellular status to String")
                return
            }

            bluetoothStateActual = bluetoothState
            bluetoothLowEnergyStateActual = bluetoothLowEnergyState
            wifiStateActual = wifiState
            cellularStateActual = cellularState
        } else {
            XCTFail("Can not convert network status JSON string to dictionary")
        }
    }
    @objc func context(context: AppContext, didUpdateDiscoveryAdvertisingState discoveryAdvertisingState: String) {}
    @objc func context(context: AppContext, didFailIncomingConnectionToPort port: UInt16) {}
    @objc func appWillEnterBackground(withContext context: AppContext) {}
    @objc func appDidEnterForeground(withContext context: AppContext) {}
}

// MARK: - Test cases
class AppContextTests: XCTestCase {

    var context: AppContext! = nil
    var expectation: XCTestExpectation?

    override func setUp() {
        context = AppContext(serviceType: "thaliTest")
    }

    override func tearDown() {
        context = nil
    }

    // MARK: - private functions

    // MARK: - tests
    func testUpdateNetworkStatus() {

        // Check if we have correct parameters in network status
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

            XCTAssertEqual(
                dictinaryNetworkStatus.count,
                expectedParameters.count,
                "Wrong amount of parameters in network status"
            )

            for expectedParameter in expectedParameters {
                XCTAssertNotNil(
                    dictinaryNetworkStatus[expectedParameter],
                    "Network status doesn't contain \(expectedParameter) parameter"
                )
            }
        } else {
            XCTFail("Can not convert network status JSON string to dictionary")
        }

        // Dynamically check if networkStatus responds on turning on/off radios
        var bluetoothStateExpected: String!
        var bluetoothLowEnergyStateExpected: String!
        var cellularStateExpected: String!

        // Dersim Davaod (8/19/16):
        // For some unknown reasons we should invoke
        // - sharedInstance method on main thread at the early time.
        dispatch_async(dispatch_get_main_queue(), {
            BluetoothHardwareControlManager.sharedInstance()
        })

        NSThread.sleepForTimeInterval(1)

        // Push hardware state
        let bluetoothIsPoweredBeforeTest = BluetoothHardwareControlManager.sharedInstance().bluetoothIsPowered()

        // Turn bluetooth (and BLE) on and check status
        if !bluetoothIsPoweredBeforeTest {

            expectation = expectationWithDescription("Bluetooth turned on")

            BluetoothHardwareControlManager.sharedInstance().turnBluetoothOn()

            waitForExpectationsWithTimeout(10) { error in
                XCTAssertNotNil(
                    error,
                    "Can not turn on bluetooth hardware"
                )
            }
        }


        let _ = try? context.didRegisterToNative([AppContextJSEvent.networkChanged, NSNull()])
        NSThread.sleepForTimeInterval(1)

        bluetoothStateExpected = "on"
        bluetoothLowEnergyStateExpected = "on"

        XCTAssertEqual(
            delegateMock.bluetoothStateActual,
            bluetoothStateExpected,
            "Wrong bluetooth state (expected: \(bluetoothStateExpected), " +
                "real: \(delegateMock.bluetoothStateActual))"
        )

        XCTAssertEqual(
            delegateMock.bluetoothLowEnergyStateActual,
            bluetoothLowEnergyStateExpected,
            "Wrong bluetoothLowEnergyState state (expected: on, " +
                "real: \(delegateMock.bluetoothLowEnergyStateActual))"
        )

        // Turn bluetooth (and BLE) off and check status
        expectation = expectationWithDescription("Bluetooth turned off")

        BluetoothHardwareControlManager.sharedInstance().turnBluetoothOff()

        waitForExpectationsWithTimeout(10) { error in
            XCTAssertNotNil(
                error,
                "Can not turn off bluetooth hardware"
            )
        }

        let _ = try? context.didRegisterToNative([AppContextJSEvent.networkChanged, NSNull()])
        NSThread.sleepForTimeInterval(1)

        bluetoothStateExpected = "off"
        bluetoothLowEnergyStateExpected = "off"

        XCTAssertEqual(
            delegateMock.bluetoothStateActual,
            bluetoothStateExpected,
            "Wrong bluetooth state (expected: \(bluetoothStateExpected), " +
                "real: \(delegateMock.bluetoothStateActual))"
        )

        XCTAssertEqual(
            delegateMock.bluetoothLowEnergyStateActual,
            bluetoothLowEnergyStateExpected,
            "Wrong bluetoothLowEnergyState state (expected: \(bluetoothLowEnergyStateExpected), " +
                "real: \(delegateMock.bluetoothLowEnergyStateActual))"
        )

        // Check cellular status
        cellularStateExpected = "doNotCare"

        XCTAssertEqual(
            delegateMock.cellularStateActual,
            cellularStateExpected,
            "Wrong cellular state (expected: \(cellularStateExpected), " +
                "real: \(delegateMock.cellularStateActual))"
        )

        // Restore hardware state
        bluetoothIsPoweredBeforeTest
            ? BluetoothHardwareControlManager.sharedInstance().turnBluetoothOn()
            : BluetoothHardwareControlManager.sharedInstance().turnBluetoothOff()
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
        } catch let err as AppContextError {
            contextError = err
        } catch _ {
        }
        XCTAssertEqual(contextError, .BadParameters)
    }

    func testGetIOSVersion() {
        XCTAssertEqual(NSProcessInfo().operatingSystemVersionString, context.getIOSVersion())
    }
    
    func testPeerAvailabilityConversion() {
        let peerAvailability = PeerAvailability(peerIdentifier: PeerIdentifier(), available: true)
        let dictionaryValue = peerAvailability.dictionaryValue
        XCTAssertEqual(peerAvailability.peerIdentifier.uuid, dictionaryValue[JSONValueKey.PeerIdentifier.rawValue] as? String)
        XCTAssertEqual(peerAvailability.peerIdentifier.generation, dictionaryValue[JSONValueKey.Generation.rawValue] as? Int)
        XCTAssertEqual(peerAvailability.available, dictionaryValue[JSONValueKey.PeerAvailable.rawValue] as? Bool)
    }
}

extension AppContextTests : BluetoothHardwareControlObserverProtocol {

    func receivedBluetoothNotification(btNotification: BluetoothHardwareControlNotification) {
        if btNotification == PowerChangedNotification {
            expectation?.fulfill()
        }
    }
}
