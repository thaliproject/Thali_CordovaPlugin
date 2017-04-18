//
//  AppContextTests.swift
//  Thali
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import SwiftXCTest
import ThaliCore
import UIKit

// MARK: - Random string generator
extension String {

  static func random(_ length: Int) -> String {
    let letters: String = "abcdefghkmnopqrstuvxyzABCDEFGHKLMNOPQRSTUXYZ"
    var randomString = ""

    let lettersLength = UInt32(letters.characters.count)
    for _ in 0..<length {
      let rand = Int(arc4random_uniform(lettersLength))
      let char = letters[letters.characters.index(letters.startIndex, offsetBy: rand)]
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

    static let  bluetoothStateIsChanged: TimeInterval = 10
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

  init(peerAvailabilityChangedHandler: @escaping (String) -> Void) {
    self.peerAvailabilityChangedHandler = peerAvailabilityChangedHandler
  }

  @objc func context(_ context: AppContext,
                     didResolveMultiConnectWithSyncValue value: String,
                     error: NSObject?,
                     listeningPort: NSObject?) {}
  @objc func context(_ context: AppContext,
                     didFailMultiConnectConnectionWith paramsJSONString: String) {}
  @objc func context(_ context: AppContext, didChangePeerAvailability peers: String) {
    peerAvailabilityChangedHandler(peers)
  }
  @objc func context(_ context: AppContext, didChangeNetworkStatus status: String) {
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
  @objc func context(_ context: AppContext,
                     didUpdateDiscoveryAdvertisingState discoveryAdvertisingState: String) {
    advertisingListeningState = discoveryAdvertisingState
  }
  @objc func context(_ context: AppContext, didFailIncomingConnectionToPort port: UInt16) {}
  @objc func appWillEnterBackground(with context: AppContext) {
    willEnterBackground = true
  }
  @objc func appDidEnterForeground(with context: AppContext) {
    didEnterForeground = true
  }
}

// MARK: - Test cases
class AppContextTests: XCTestCase {

  static var allTests = {
    return [
      ("test_willEnterBackground", testWillEnterBackground),
      ("test_didEnterForeground", testDidEnterForeground),
      ("test_didRegisterToNative", testDidRegisterToNative),
      ("test_getIOSVersion", testGetIOSVersion),
      ("test_thaliCoreErrors", testThaliCoreErrors),
      ("test_errorDescription", testErrorDescription),
      ("test_esonValue", testJsonValue),
      ("test_listeningAdvertisingUpdateOnStartAdvertising", testListeningAdvertisingUpdateOnStartAdvertising),
      ("test_listeningAdvertisingUpdateOnStartListening", testListeningAdvertisingUpdateOnStartListening),
      ("test_startAdvertisingAndListeningInvokePeerAvailabilityChangedForDifferentContexts",
        testStartAdvertisingAndListeningInvokePeerAvailabilityChangedForDifferentContexts),
      ("test_peerAvailabilityConversion", testPeerAvailabilityConversion),
      ("test_disconnectErrors", testDisconnectErrors),
      ("test_connectReturnValueCorrect", testConnectReturnValueCorrect),
    ]
  }()

  var context: AppContext! = nil

  weak var expectationThatPrivateBluetoothStateIsChanged: XCTestExpectation?
  weak var expectationThatCoreBluetoothStateIsChanged: XCTestExpectation?
  weak var expectationThatBothBluetoothStatesAreChanged: XCTestExpectation?
  var bluetoothChangingStateGroup: DispatchGroup?

  override func setUp() {
    let serviceType = String.random(8)
    context = AppContext(serviceType: serviceType)
  }

  override func tearDown() {
    context = nil
  }

  fileprivate func jsonDictionaryFrom(_ string: String) -> [String : AnyObject]? {
    guard let data = string.data(using: String.Encoding.utf8) else {
      return nil
    }
    return (try? JSONSerialization.jsonObject(with: data, options: [])) as?
      [String : AnyObject]
  }

  // MARK: Tests

  fileprivate func validateAdvertisingUpdate(_ jsonString: String, advertising: Bool, browsing: Bool) {
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
    NotificationCenter.default
                        .post(name: NSNotification.Name.UIApplicationWillResignActive,
                                              object: nil)
    XCTAssertTrue(delegateMock.willEnterBackground)
  }

  func testDidEnterForeground() {
    let delegateMock = AppContextDelegateMock(peerAvailabilityChangedHandler: { _ in
      XCTFail("unexpected peerAvailabilityChanged event")
    })
    context.delegate = delegateMock
    NotificationCenter.default
                        .post(name: NSNotification.Name.UIApplicationDidBecomeActive,
                                              object: nil)
    XCTAssertTrue(delegateMock.didEnterForeground)
  }

  func testDidRegisterToNative() {
    var error: Error?
    do {
      try context.didRegisterToNative(["test" as AnyObject, "test" as AnyObject])
    } catch let err {
      error = err
    }
    XCTAssertNil(error)
    var contextError: AppContextError?
    do {
      let notAString = 42
      try context.didRegisterToNative([notAString as AnyObject])
    } catch let err as AppContextError {
      contextError = err
    } catch let error {
      XCTFail("unexpected error: \(error)")
    }
    XCTAssertEqual(contextError, .badParameters)
  }

  func testGetIOSVersion() {
    XCTAssertEqual(ProcessInfo().operatingSystemVersionString, context.getIOSVersion())
  }

  func testThaliCoreErrors() {
    // testing parameters count
    context.multiConnectToPeer(["" as AnyObject]) {
      guard let err = $0 as? AppContextError else {
        XCTFail("unexpected error \($0)")
        return
      }
      XCTAssertEqual(err, AppContextError.badParameters)
    }
    // testing parameter types
    context.multiConnectToPeer([2 as AnyObject, 2 as AnyObject]) {
      guard let err = $0 as? AppContextError else {
        XCTFail("unexpected error \($0)")
        return
      }
      XCTAssertEqual(err, AppContextError.badParameters)
    }
  }

  func testErrorDescription() {
    XCTAssertEqual(ThaliCoreError.illegalPeerID.rawValue,
                   ThaliCoreError.illegalPeerID.errorDescription)
  }

  func testJsonValue() {
    var jsonDict: [String : AnyObject] = ["number" : 4.2 as AnyObject]
    var jsonString = "{\"number\":4.2}"
    XCTAssertEqual(jsonValue(jsonDict as AnyObject), jsonString)
    jsonDict = ["string" : "42" as AnyObject]
    jsonString = "{\"string\":\"42\"}"
    XCTAssertEqual(jsonValue(jsonDict as AnyObject), jsonString)
    jsonDict = ["null" : NSNull()]
    jsonString = "{\"null\":null}"
    XCTAssertEqual(jsonValue(jsonDict as AnyObject), jsonString)
    jsonDict = ["bool" : true as AnyObject]
    jsonString = "{\"bool\":true}"
    XCTAssertEqual(jsonValue(jsonDict as AnyObject), jsonString)
  }

  func testListeningAdvertisingUpdateOnStartAdvertising() {
    let delegateMock = AppContextDelegateMock(peerAvailabilityChangedHandler: { _ in
      XCTFail("unexpected peerAvailabilityChanged event")
    })
    context.delegate = delegateMock
    let port = 42
    let _ = try? context.startUpdateAdvertisingAndListening(withParameters: [port as AnyObject])
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
        expectation(description: "found peer from another AppContext")
      let delegateMock = AppContextDelegateMock {
        [weak foundPeerFromAnotherContextExpectation] peers in
        foundPeerFromAnotherContextExpectation?.fulfill()
      }
      let serviceType = String.random(8)
      let context1 = AppContext(serviceType: serviceType)
      context1.delegate = delegateMock
      let context2 = AppContext(serviceType: serviceType)
      let port = 42

      try context1.startListeningForAdvertisements()
      try context2.startUpdateAdvertisingAndListening(withParameters: [port as AnyObject])

      let foundPeerTimeout: TimeInterval = 10
      waitForExpectations(timeout: foundPeerTimeout, handler: nil)

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
      try context.disconnect([notAString as AnyObject])
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
  @objc fileprivate func centralBluetoothManagerStateChanged(_ notification: Notification) {
    if notification.name == NSNotification.Name(rawValue: Constants.NSNotificationName.centralBluetoothManagerDidChangeState) {
      expectationThatCoreBluetoothStateIsChanged?.fulfill()
      if let bluetoothChangingStateGroup = bluetoothChangingStateGroup {
        bluetoothChangingStateGroup.leave()
      }
    }
  }

  fileprivate func changeBluetoothState(to state: BluetoothHardwareState,
                                       andWaitUntilChangesWithTimeout timeout: TimeInterval) {

    bluetoothChangingStateGroup = DispatchGroup()

    expectationThatBothBluetoothStatesAreChanged =
      expectation(description: "Bluetooth is turned \(state.rawValue)")

    // When we're switching bluetooth hardware, we're waiting for two async acknowledgements.
    // The first one is from private API, the second acknowledgement is from CoreBluetooth.
    // This is why we enter the same group twice
    bluetoothChangingStateGroup!.enter()
    bluetoothChangingStateGroup!.enter()

    state == .on
             ? BluetoothHardwareControlManager.sharedInstance().turnBluetoothOn()
             : BluetoothHardwareControlManager.sharedInstance().turnBluetoothOff()

    bluetoothChangingStateGroup!.notify(
      queue: DispatchQueue.global(priority: DispatchQueue.GlobalQueuePriority.background),
      execute: {
        self.privateAndPublicBluetoothStatesDidChanged()
      }
    )

    waitForExpectations(timeout: Constants.TimeForWhich.bluetoothStateIsChanged) {
      error in
      XCTAssertNil(
        error,
        "Can not turn \(state.rawValue) Bluetooth hardware"
      )
    }

    bluetoothChangingStateGroup = nil
    expectationThatBothBluetoothStatesAreChanged = nil
  }

  fileprivate func privateAndPublicBluetoothStatesDidChanged() {
    expectationThatBothBluetoothStatesAreChanged?.fulfill()
  }
}
