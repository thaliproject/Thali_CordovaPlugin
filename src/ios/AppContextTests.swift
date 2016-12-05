//
//  Thali CordovaPlugin
//  AppContextTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import XCTest
import UIKit
import ThaliCore

// MARK: - Random string generator
extension String {

  static func random(length length: Int) -> String {
    let letters: String = "abcdefghkmnopqrstuvxyzABCDEFGHKLMNOPQRSTUXYZ"
    var randomString = ""

    let lettersLength = UInt32(letters.characters.count)
    for _ in 0..<length {
      let rand = Int(arc4random_uniform(lettersLength))
      let char = letters[letters.startIndex.advancedBy(rand)]
      randomString.append(char)
    }
    return randomString
  }
}

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

  var advertisingListeningState = ""

  var willEnterBackground = false
  var didEnterForeground = false
  var discoveryUpdated = false

  let peerAvailabilityChangedHandler: (String) -> Void

  init(peerAvailabilityChangedHandler: (String) -> Void) {
    self.peerAvailabilityChangedHandler = peerAvailabilityChangedHandler
  }

  @objc func context(context: AppContext,
                     didResolveMultiConnectWithSyncValue value: String,
                     error: NSObject?,
                     listeningPort: NSObject?) {}
  @objc func context(context: AppContext,
                     didFailMultiConnectConnectionWith paramsJSONString: String) {}
  @objc func context(context: AppContext, didChangePeerAvailability peers: String) {
    peerAvailabilityChangedHandler(peers)
  }
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
          dictinaryNetworkStatus[NetworkStatusParameters.bluetooth.rawValue] as? String
        else {
          return
      }

      guard
        let bluetoothLowEnergyState =
          dictinaryNetworkStatus[NetworkStatusParameters.bluetoothLowEnergy.rawValue] as? String
        else {
          return
      }

      guard let wifiState = dictinaryNetworkStatus[NetworkStatusParameters.wifi.rawValue] as? String
        else {
          return
      }

      guard
        let cellularState =
          dictinaryNetworkStatus[NetworkStatusParameters.cellular.rawValue] as? String
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
                     didUpdateDiscoveryAdvertisingState discoveryAdvertisingState: String) {
    advertisingListeningState = discoveryAdvertisingState
  }
  @objc func context(context: AppContext, didFailIncomingConnectionToPort port: UInt16) {}
  @objc func appWillEnterBackground(with context: AppContext) {
    willEnterBackground = true
  }
  @objc func appDidEnterForeground(with context: AppContext) {
    didEnterForeground = true
  }
}

// MARK: - Test cases
class AppContextTests: XCTestCase {

  var context: AppContext! = nil

  weak var expectationThatPrivateBluetoothStateIsChanged: XCTestExpectation?
  weak var expectationThatCoreBluetoothStateIsChanged: XCTestExpectation?
  weak var expectationThatBothBluetoothStatesAreChanged: XCTestExpectation?
  var bluetoothChangingStateGroup: dispatch_group_t?

  override func setUp() {
    let serviceType = String.random(length: 8)
    context = AppContext(serviceType: serviceType)
  }

  override func tearDown() {
    context = nil
  }

  private func jsonDictionaryFrom(string: String) -> [String : AnyObject]? {
    guard let data = string.dataUsingEncoding(NSUTF8StringEncoding) else {
      return nil
    }
    return (try? NSJSONSerialization.JSONObjectWithData(data, options: [])) as?
      [String : AnyObject]
  }

  // MARK: Tests

  private func validateAdvertisingUpdate(jsonString: String, advertising: Bool, browsing: Bool) {
    let json = jsonDictionaryFrom(jsonString)
    let listeningActive = (json?[JSONKey.discoveryActive.rawValue] as? Bool)
    let advertisingActive = (json?[JSONKey.advertisingActive.rawValue] as? Bool)
    print(advertisingActive)
    print(listeningActive)
    XCTAssertEqual(advertisingActive, advertising)
    XCTAssertEqual(listeningActive, browsing)
  }

  func testWillEnterBackground() {
    let delegateMock = AppContextDelegateMock(peerAvailabilityChangedHandler: { _ in
      XCTFail("unexpected peerAvailabilityChanged event")
    })
    context.delegate = delegateMock
    NSNotificationCenter.defaultCenter()
                        .postNotificationName(UIApplicationWillResignActiveNotification,
                                              object: nil)
    XCTAssertTrue(delegateMock.willEnterBackground)
  }

  func testDidEnterForeground() {
    let delegateMock = AppContextDelegateMock(peerAvailabilityChangedHandler: { _ in
      XCTFail("unexpected peerAvailabilityChanged event")
    })
    context.delegate = delegateMock
    NSNotificationCenter.defaultCenter()
                        .postNotificationName(UIApplicationDidBecomeActiveNotification,
                                              object: nil)
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
      let notAString = 42
      try context.didRegisterToNative([notAString])
    } catch let err as AppContextError {
      contextError = err
    } catch let error {
      XCTFail("unexpected error: \(error)")
    }
    XCTAssertEqual(contextError, .badParameters)
  }

  func testGetIOSVersion() {
    XCTAssertEqual(NSProcessInfo().operatingSystemVersionString, context.getIOSVersion())
  }

  func testThaliCoreErrors() {
    // testing parameters count
    context.multiConnectToPeer([""]) {
      guard let err = $0 as? AppContextError else {
        XCTFail("unexpected error \($0)")
        return
      }
      XCTAssertEqual(err, AppContextError.badParameters)
    }
    // testing parameter types
    context.multiConnectToPeer([2, 2]) {
      guard let err = $0 as? AppContextError else {
        XCTFail("unexpected error \($0)")
        return
      }
      XCTAssertEqual(err, AppContextError.badParameters)
    }
  }

  func testErrorDescription() {
    XCTAssertEqual(ThaliCoreError.IllegalPeerID.rawValue,
                   errorDescription(ThaliCoreError.IllegalPeerID))

    let unknownError = AppContextError.unknownError
    XCTAssertEqual((unknownError as NSError).localizedDescription,
                   errorDescription(unknownError))
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

  func testListeningAdvertisingUpdateOnStartAdvertising() {
    let delegateMock = AppContextDelegateMock(peerAvailabilityChangedHandler: { _ in
      XCTFail("unexpected peerAvailabilityChanged event")
    })
    context.delegate = delegateMock
    let port = 42
    let _ = try? context.startUpdateAdvertisingAndListening(withParameters: [port])
    validateAdvertisingUpdate(delegateMock.advertisingListeningState, advertising: true,
                              browsing: false)
  }

  func testListeningAdvertisingUpdateOnStartListening() {
    let delegateMock = AppContextDelegateMock(peerAvailabilityChangedHandler: { _ in
      XCTFail("unexpected peerAvailabilityChanged event")
    })
    context.delegate = delegateMock
    let _ = try? context.startListeningForAdvertisements()
    validateAdvertisingUpdate(delegateMock.advertisingListeningState, advertising: false,
                              browsing: true)
  }

  func testStartAdvertisingAndListeningInvokePeerAvailabilityChangedForDifferentContexts() {
    do {
      let foundPeerFromAnotherContextExpectation =
        expectationWithDescription("found peer from another AppContext")
      let delegateMock = AppContextDelegateMock {
        [weak foundPeerFromAnotherContextExpectation] peers in
        foundPeerFromAnotherContextExpectation?.fulfill()
      }
      let serviceType = String.random(length: 8)
      let context1 = AppContext(serviceType: serviceType)
      context1.delegate = delegateMock
      let context2 = AppContext(serviceType: serviceType)
      let port = 42

      try context1.startListeningForAdvertisements()
      try context2.startUpdateAdvertisingAndListening(withParameters: [port])

      let foundPeerTimeout: NSTimeInterval = 10
      waitForExpectationsWithTimeout(foundPeerTimeout, handler: nil)

    } catch let error {
      XCTFail("unexpected error: \(error)")
    }
  }

  func testPeerAvailabilityConversion() {
    let peerAvailability = PeerAvailability(peer: Peer(), available: true)
    let dictionaryValue = peerAvailability.dictionaryValue
    XCTAssertEqual(peerAvailability.peerIdentifier,
                   dictionaryValue[JSONKey.peerIdentifier.rawValue] as? String)
    XCTAssertEqual(peerAvailability.generation,
                   dictionaryValue[JSONKey.generation.rawValue] as? Int)
    XCTAssertEqual(peerAvailability.available,
                   dictionaryValue[JSONKey.peerAvailable.rawValue] as? Bool)
  }

  func testDisconnectErrors() {
    var contextError: AppContextError?
    do {
      let notAString = 42
      try context.disconnect([notAString])
    } catch let err as AppContextError {
      contextError = err
    } catch let error {
      XCTFail("unexpected error: \(error)")
    }
    XCTAssertEqual(contextError, .badParameters)
  }

  func testConnectReturnValueCorrect() {
    let result = context.connect([])
    let json = jsonDictionaryFrom(result)
    XCTAssertEqual(json?[JSONKey.err.rawValue] as? String, "Platform does not support connect")
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

    // When we're switching bluetooth hardware, we're waiting for two async acknowledgements.
    // The first one is from private API, the second acknowledgement is from CoreBluetooth.
    // This is why we enter the same group twice
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
