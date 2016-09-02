//
//  Thali CordovaPlugin
//  AppContextTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import XCTest
import ThaliCore

extension NetworkStatusParameters {

    static let allValues = [bluetooth, bluetoothLowEnergy, wifi, cellular, bssid]
}

struct Constants {

    struct TimeForWhich {

        static let  bluetoothStateIsChanged: NSTimeInterval = 10
    }

    struct NSNotificationName {

        static let centralBluetoothManagerDidChangeState = "CentralBluetoothManagerDidChangeState"
    }
}

private extension Selector {

    static let centralBluetoothManagerStateChanged =
        #selector(AppContextTests.centralBluetoothManagerStateChanged(_:))
}

enum BluetoothHardwareState: String {
    case on = "on"
    case off = "off"
}

// MARK: - Mock objects
class AppContextDelegateMock: NSObject, AppContextDelegate {
    /// Network status represented as JSON String.
    /// Gets updated value in didChangeNetworkStatus method.
    var networkStatus: String?

    /// Indicates that didChangeNetworkStatus method was called at least once.
    var networkStatusUpdated = false

    /// Bluetooth RadioState value represented as String
    /// Gets updated value in didChangeNetworkStatus method.
    var bluetoothStateActual: String?

    /// BluetoothLowEnergy RadioState value represented as String
    /// Gets updated value in didChangeNetworkStatus method.
    var bluetoothLowEnergyStateActual: String?

    /// WiFi RadioState value represented as String
    /// Gets updated value in didChangeNetworkStatus method.
    var wifiStateActual: String?

    /// Cellular RadioState value represented as String
    /// Gets updated value in didChangeNetworkStatus method.
    var cellularStateActual: String?

    @objc func context(context: AppContext, didChangePeerAvailability peers: String) {}
    @objc func context(context: AppContext, didChangeNetworkStatus status: String) {
        networkStatusUpdated = true
        networkStatus = status

        bluetoothStateActual = nil
        bluetoothLowEnergyStateActual = nil
        wifiStateActual = nil
        cellularStateActual = nil

        if let dictinaryNetworkStatus = dictionaryValue(networkStatus!) {

            guard
                let bluetoothState =
                dictinaryNetworkStatus[NetworkStatusParameters.bluetooth.rawValue]
                    as? String
                else {
                    return
            }

            guard
                let bluetoothLowEnergyState =
                dictinaryNetworkStatus[NetworkStatusParameters.bluetoothLowEnergy.rawValue]
                    as? String
                else {
                    return
            }

            guard
                let wifiState =
                dictinaryNetworkStatus[NetworkStatusParameters.wifi.rawValue]
                    as? String
                else {
                    return
            }

            guard
                let cellularState =
                dictinaryNetworkStatus[NetworkStatusParameters.cellular.rawValue]
                    as? String
                else {
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
    @objc func context(context: AppContext,
                       didUpdateDiscoveryAdvertisingState discoveryAdvertisingState: String) {}
    @objc func context(context: AppContext, didFailIncomingConnectionToPort port: UInt16) {}
    @objc func appWillEnterBackground(withContext context: AppContext) {}
    @objc func appDidEnterForeground(withContext context: AppContext) {}
}

// MARK: - Test cases
class AppContextTests: XCTestCase {

    var context: AppContext! = nil

    weak var expectationThatPrivateBluetoothStateIsChanged: XCTestExpectation?
    weak var expectationThatCoreBluetoothStateIsChanged: XCTestExpectation?
    weak var expectationThatBothBluetoothStatesAreChanged: XCTestExpectation?
    var bluetoothChangingStateGroup: dispatch_group_t?

    override func setUp() {
        context = AppContext(serviceType: "thaliTest")
    }

    override func tearDown() {
        context = nil
    }

    // MARK: Tests
    func testUpdateNetworkStatus() {

        // MARK: Register observers
        NSNotificationCenter.defaultCenter().addObserver(
            self,
            selector: Selector.centralBluetoothManagerStateChanged,
            name: Constants.NSNotificationName.centralBluetoothManagerDidChangeState,
            object: context
        )

        BluetoothHardwareControlManager.sharedInstance().registerObserver(self)


        // MARK: Check if we have correct parameters in network status
        // Given
        let delegateMock = AppContextDelegateMock()
        context.delegate = delegateMock

        expectationThatCoreBluetoothStateIsChanged =
            expectationWithDescription(
                "Central Bluetooth Manager has actual state either .PoweredOn or .PoweredOff"
        )
        waitForExpectationsWithTimeout(Constants.TimeForWhich.bluetoothStateIsChanged) {
            error in
            XCTAssertNil(
                error,
                "Can't update Central Bluetooth Manager state"
            )
        }

        expectationThatCoreBluetoothStateIsChanged = nil

        // When
        let _ = try? context.didRegisterToNative([AppContextJSEvent.networkChanged, NSNull()])

        // Then
        XCTAssertTrue(delegateMock.networkStatusUpdated, "network status is not updated")

        if let dictinaryNetworkStatus = dictionaryValue(delegateMock.networkStatus!) {

            XCTAssertEqual(
                dictinaryNetworkStatus.count,
                NetworkStatusParameters.allValues.count,
                "Wrong amount of parameters in network status" +
                    "(Expected: \(dictinaryNetworkStatus.count), " +
                    "Actual: \(NetworkStatusParameters.allValues.count))"
            )

            for expectedParameter in NetworkStatusParameters.allValues {
                XCTAssertNotNil(
                    dictinaryNetworkStatus[expectedParameter.rawValue],
                    "Network status doesn't contain \(expectedParameter.rawValue) parameter"
                )
            }
        } else {
            XCTFail("Can not convert network status JSON string to dictionary")
        }


        // MARK: Store Bluetooth power state
        let bluetoothWasPoweredBeforeTest =
            BluetoothHardwareControlManager.sharedInstance().bluetoothIsPowered()


        // MARK: Dynamically check if networkStatus responds on turning on Bluetooth
        // Given
        var bluetoothStateExpected = RadioState.on.rawValue
        var bluetoothLowEnergyStateExpected = RadioState.on.rawValue

        let bluetoothShouldBeTurnedOn = !bluetoothWasPoweredBeforeTest
        if bluetoothShouldBeTurnedOn {

            changeBluetoothState(
                to: .on,
                andWaitUntilChangesWithTimeout: Constants.TimeForWhich.bluetoothStateIsChanged
            )
        }

        // When
        let _ = try? context.didRegisterToNative([AppContextJSEvent.networkChanged, NSNull()])

        // Then
        XCTAssertEqual(
            delegateMock.bluetoothStateActual,
            bluetoothStateExpected,
            "Wrong bluetooth state." +
                "Expected: \(bluetoothStateExpected), " +
                "actual: \(delegateMock.bluetoothStateActual))"
        )

        XCTAssertEqual(
            delegateMock.bluetoothLowEnergyStateActual,
            bluetoothLowEnergyStateExpected,
            "Wrong bluetoothLowEnergyState state. " +
                "Expected: \(bluetoothLowEnergyStateExpected), " +
                "actual: \(delegateMock.bluetoothLowEnergyStateActual))"
        )


        // MARK: Dynamically check if networkStatus responds on turning off Bluetooth
        // Given
        bluetoothStateExpected = RadioState.off.rawValue
        bluetoothLowEnergyStateExpected = RadioState.off.rawValue

        changeBluetoothState(
            to: .off,
            andWaitUntilChangesWithTimeout: Constants.TimeForWhich.bluetoothStateIsChanged
        )

        // When
        let _ = try? context.didRegisterToNative([AppContextJSEvent.networkChanged, NSNull()])

        // Then
        XCTAssertEqual(
            delegateMock.bluetoothStateActual,
            bluetoothStateExpected,
            "Wrong bluetooth state. " +
                "Expected: \(bluetoothStateExpected), " +
                "actual: \(delegateMock.bluetoothStateActual))"
        )

        XCTAssertEqual(
            delegateMock.bluetoothLowEnergyStateActual,
            bluetoothLowEnergyStateExpected,
            "Wrong bluetoothLowEnergyState state. " +
                "Expected: \(bluetoothLowEnergyStateExpected), " +
                "actual: \(delegateMock.bluetoothLowEnergyStateActual))"
        )


        // MARK: Check cellular status
        // Given
        let cellularStateExpected = RadioState.doNotCare.rawValue

        // Then
        XCTAssertEqual(
            delegateMock.cellularStateActual,
            cellularStateExpected,
            "Wrong cellular state. " +
                "Expected: \(cellularStateExpected), " +
                "actual: \(delegateMock.cellularStateActual))"
        )


        // MARK: Restore Bluetooth power state
        let bluetoothIsPoweredAfterTest =
            BluetoothHardwareControlManager.sharedInstance().bluetoothIsPowered()

        if bluetoothWasPoweredBeforeTest != bluetoothIsPoweredAfterTest {

            changeBluetoothState(
                to: bluetoothWasPoweredBeforeTest ? .on : .off,
                andWaitUntilChangesWithTimeout: Constants.TimeForWhich.bluetoothStateIsChanged
            )
        }

        NSNotificationCenter.defaultCenter().removeObserver(self)
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


    // MARK: Private helpers
    @objc private func centralBluetoothManagerStateChanged(notification: NSNotification) {
        if notification.name == Constants.NSNotificationName.centralBluetoothManagerDidChangeState {
            expectationThatCoreBluetoothStateIsChanged?.fulfill()
            if let bluetoothChangingStateGroup = bluetoothChangingStateGroup {
                dispatch_group_leave(bluetoothChangingStateGroup)
            }
        }
    }

    private func changeBluetoothState(to state: BluetoothHardwareState,
                                         andWaitUntilChangesWithTimeout timeout: NSTimeInterval) {

        bluetoothChangingStateGroup = dispatch_group_create()

        expectationThatBothBluetoothStatesAreChanged =
            expectationWithDescription("Bluetooth is turned \(state.rawValue)")

        dispatch_group_enter(bluetoothChangingStateGroup!)
        dispatch_group_enter(bluetoothChangingStateGroup!)

        state == .on
            ? BluetoothHardwareControlManager.sharedInstance().turnBluetoothOn()
            : BluetoothHardwareControlManager.sharedInstance().turnBluetoothOff()

        dispatch_group_notify(
            bluetoothChangingStateGroup!,
            dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_BACKGROUND, 0), {
                self.privateAndPublicBluetoothStatesDidChanged()
            }
        )

        waitForExpectationsWithTimeout(Constants.TimeForWhich.bluetoothStateIsChanged) {
            error in
            XCTAssertNil(
                error,
                "Can not turn \(state.rawValue) Bluetooth hardware"
            )
        }

        bluetoothChangingStateGroup = nil
        expectationThatBothBluetoothStatesAreChanged = nil
    }

    private func privateAndPublicBluetoothStatesDidChanged() {
        expectationThatBothBluetoothStatesAreChanged?.fulfill()
    }
}

extension AppContextTests : BluetoothHardwareControlObserverProtocol {

    func receivedBluetoothManagerNotificationWithName(bluetoothNotificationName: String) {
        if bluetoothNotificationName == PowerChangedNotification {
            expectationThatPrivateBluetoothStateIsChanged?.fulfill()
            if let bluetoothChangingStateGroup = bluetoothChangingStateGroup {
                dispatch_group_leave(bluetoothChangingStateGroup)
            }
        }
    }
}
