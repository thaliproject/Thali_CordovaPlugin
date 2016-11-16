//
//  Thali CordovaPlugin
//  AppContext.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import CoreBluetooth
import Foundation
import ThaliCore

func jsonValue(object: AnyObject) -> String {
  guard let data =
    try? NSJSONSerialization.dataWithJSONObject(object,
                                                options: NSJSONWritingOptions(rawValue:0))
    else {
      return ""
  }
  return String(data: data, encoding: NSUTF8StringEncoding) ?? ""
}

func dictionaryValue(jsonText: String) -> [String : AnyObject]? {
  if let data = jsonText.dataUsingEncoding(NSUTF8StringEncoding) {
    do {
      return try NSJSONSerialization.JSONObjectWithData(data, options: []) as? [String : AnyObject]
    } catch let error as NSError {
      print(error)
    }
  }
  return nil
}

enum RadioState: String {

  case on = "on"
  case off = "off"
  case unavailable = "unavailable"
  case notHere = "notHere"
  case doNotCare = "doNotCare"
}

enum NetworkStatusParameters: String {

  case bluetooth = "bluetooth"
  case bluetoothLowEnergy = "bluetoothLowEnergy"
  case wifi = "wifi"
  case cellular = "cellular"
  case bssid = "bssid"
  case ssid = "ssid"
}

@objc public enum AppContextError: Int, ErrorType, CustomStringConvertible {

  case badParameters
  case unknownError
  case connectNotSupported

  public var description: String {
    switch self {
    case .badParameters:
      return "Bad parameters"
    case .unknownError:
      return "Unknown error"
    case .connectNotSupported:
      return "Platform does not support connect"
    }
  }
}

/*!
 JSON keys for thaliMobileNative callbacks parameters

 */
public enum JSONKey: String {

  case peerIdentifier
  case peerAvailable
  case discoveryActive
  case advertisingActive
  case generation
  case err
}

// MARK: - JSON representation of PeerAvailability object
extension PeerAvailability {

  var dictionaryValue: [String : AnyObject] {
    return [JSONKey.peerIdentifier.rawValue : peerIdentifier,
            JSONKey.peerAvailable.rawValue : available,
            JSONKey.generation.rawValue : generation]
  }
}

@objc public protocol AppContextDelegate: class, NSObjectProtocol {
  /**
   Notifies about context's peer changes

   - parameter peers:   json with data about changed peers
   - parameter context: related AppContext
   */
  func context(context: AppContext, didChangePeerAvailability peersJSONString: String)

  /**
   Notifies about network status changes

   - parameter status:  json string with network availability status
   - parameter context: related AppContext
   */
  func context(context: AppContext, didChangeNetworkStatus statusJSONString: String)

  /**
   Notifies about peer advertisement update

   - parameter discoveryAdvertisingState: json with information about peer's state
   - parameter context:                   related AppContext
   */
  func context(context: AppContext,
               didUpdateDiscoveryAdvertisingState discoveryAdvertisingStateJSONString: String)

  /**
   Notifies about failing connection to port

   - parameter port:      port failed to connect
   - parameter context: related AppContext
   */
  func context(context: AppContext, didFailIncomingConnectionToPort port: UInt16)

  /**
   callback for multiConnect function

   */
  func context(context: AppContext,
               didResolveMultiConnectWithSyncValue value: String,
               error: NSObject?,
               listeningPort: NSObject?)

  /**
   callback for multiConnect function

   */
  func context(context: AppContext, didFailMultiConnectConnectionWith paramsJSONString: String)

  /**
   Notifies about entering background

   - parameter context: related AppContext
   */
  func appWillEnterBackground(with context: AppContext)

  /**
   Notifies about entering foreground

   - parameter context: related AppContext
   */
  func appDidEnterForeground(with context: AppContext)
}

/// Interface for communication between native and cross-platform parts
@objc public final class AppContext: NSObject {
  private let disposeAdvertiserTimeout = 30.0
  private let inputStreamReceiveTimeout = 5.0

  private let serviceType: String
  private let appNotificationsManager: ApplicationStateNotificationsManager

  private var networkChangedRegistered: Bool = false
  public weak var delegate: AppContextDelegate?
  lazy private var browserManager: BrowserManager = {
    [unowned self] in

    return BrowserManager(serviceType: self.serviceType,
                          inputStreamReceiveTimeout: self.inputStreamReceiveTimeout,
                          peerAvailabilityChanged: {
                            [weak self] peers in
                            guard let strongSelf = self else { return }

                            strongSelf.handleOnPeersAvailabilityChanged(peers)
                          })
  }()
  private let advertiserManager: AdvertiserManager

  private var bluetoothState = RadioState.unavailable
  private var bluetoothLowEnergyState = RadioState.unavailable
  private var bluetoothManager: CBCentralManager?

  private func notifyOnDidUpdateNetworkStatus() {

    var wifiState = RadioState.unavailable
    let cellularState = RadioState.doNotCare

    let networkReachability = NetworkReachability()
    let wifiEnabled = networkReachability.isWiFiEnabled()
    let wifiConnected = networkReachability.isWiFiConnected()

    wifiState = wifiEnabled ? .on : .off

    let bssid = ((wifiState == .on) && wifiConnected)
                ? networkReachability.BSSID()
                : NSNull()
    let ssid = ((wifiState == .on) && wifiConnected)
                ? networkReachability.SSID()
                : NSNull()

    let networkStatus = [
      NetworkStatusParameters.wifi.rawValue                : wifiState.rawValue,
      NetworkStatusParameters.bluetooth.rawValue           : bluetoothState.rawValue,
      NetworkStatusParameters.bluetoothLowEnergy.rawValue  : bluetoothLowEnergyState.rawValue,
      NetworkStatusParameters.cellular.rawValue            : cellularState.rawValue,
      NetworkStatusParameters.bssid.rawValue               : bssid,
      NetworkStatusParameters.ssid.rawValue                : ssid
    ]

    delegate?.context(self, didChangeNetworkStatus: jsonValue(networkStatus))
  }

  private func handleWillEnterBackground() {
    delegate?.appWillEnterBackground(with: self)
  }

  private func handleDidEnterForeground() {
    delegate?.appDidEnterForeground(with: self)
  }

  private func handleOnPeersAvailabilityChanged(peers: [PeerAvailability]) {
    let mappedPeers = peers
                      .filter {
                        // We shouldn't notify JXcore when device discovers itself
                        !self.advertiserManager.hasAdvertiser(with:$0.peerIdentifier)
                      }
                      .map {
                        $0.dictionaryValue
                      }
    guard mappedPeers.count > 0 else {
      return
    }
    delegate?.context(self, didChangePeerAvailability: jsonValue(mappedPeers))
  }

  private func updateListeningAdvertisingState() {
    let newState = [
      JSONKey.discoveryActive.rawValue : browserManager.listening,
      JSONKey.advertisingActive.rawValue : advertiserManager.advertising
    ]
    delegate?.context(self, didUpdateDiscoveryAdvertisingState: jsonValue(newState))
  }

  private func handleMultiConnectResolved(withSyncValue value: String, port: UInt16?,
                                                        error: ErrorType?) {
    let errorValue = error != nil ? errorDescription(error!) : NSNull()
    let listeningPort = port != nil ? NSNumber(unsignedShort: port!) : NSNull()
    delegate?.context(self,
                      didResolveMultiConnectWithSyncValue: value,
                      error: errorValue,
                      listeningPort: listeningPort)
  }

  private func handleMultiConnectConnectionFailure(withIdentifier identifier: String,
                                                                  error: ErrorType?) {
    let parameters = [
      "peerIdentifier" : identifier,
      "error" : error != nil ? errorDescription(error!) : NSNull()
    ]
    delegate?.context(self, didFailMultiConnectConnectionWith: jsonValue(parameters))
  }

  public init(serviceType: String) {
    appNotificationsManager = ApplicationStateNotificationsManager()
    self.serviceType = serviceType
    advertiserManager = AdvertiserManager(serviceType: serviceType,
                                          disposeAdvertiserTimeout: disposeAdvertiserTimeout)
    super.init()
    appNotificationsManager.didEnterForegroundHandler = {[weak self] in
      self?.handleDidEnterForeground()
    }
    appNotificationsManager.willEnterBackgroundHandler = { [weak self] in
      self?.handleWillEnterBackground()
    }

    #if TEST
      // We use background queue because CI tests use main_queue synchronously
      // Otherwise we won't be able to get centralManager state.
      let centralManagerDispatchQueue =
        dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_BACKGROUND, 0)
    #else
      let centralManagerDispatchQueue: dispatch_queue_t? = nil
    #endif
    bluetoothManager = CBCentralManager(delegate: self,
                                        queue: centralManagerDispatchQueue,
                                        options: [CBCentralManagerOptionShowPowerAlertKey : false])
  }

  public func startListeningForAdvertisements() throws {
    browserManager.startListeningForAdvertisements { [weak self] error in
      print("failed start listening due the error \(error)")
      self?.updateListeningAdvertisingState()
    }
    updateListeningAdvertisingState()
  }

  public func stopListeningForAdvertisements() throws {
    browserManager.stopListeningForAdvertisements()
    updateListeningAdvertisingState()
  }

  public func startUpdateAdvertisingAndListening(withParameters parameters: [AnyObject]) throws {
    guard let port = (parameters.first as? NSNumber)?.unsignedShortValue else {
      throw AppContextError.badParameters
    }
    advertiserManager.startUpdateAdvertisingAndListening(onPort: port) { [weak self] error in
      print("failed start advertising due the error \(error)")
      self?.updateListeningAdvertisingState()
    }
    updateListeningAdvertisingState()
  }

  public func stopAdvertisingAndListening() throws {
    self.advertiserManager.stopAdvertising()
    self.updateListeningAdvertisingState()
  }

  public func multiConnectToPeer(parameters: [AnyObject],
                                 validationCompletionHandler: (NSError?) -> Void) {
    guard parameters.count >= 2 else {
      validationCompletionHandler(AppContextError.badParameters as NSError)
      return
    }
    guard let identifierString = parameters[0] as? String, syncValue = parameters[1] as? String
      else {
        validationCompletionHandler(AppContextError.badParameters as NSError)
        return
    }
    validationCompletionHandler(nil)

    // This code MUST be executed after validation to avoid racing on JXcore side between
    // multiConnect and multiConnectResolved callbacks
    do {
      let _ = try Peer(uuidIdentifier: identifierString, generation: 0)
      guard self.bluetoothState == .on || NetworkReachability().isWiFiEnabled()
        else {
          self.handleMultiConnectConnectionFailure(withIdentifier: identifierString,
                                                   error: ThaliCoreError.RadioTurnedOff)
          return
      }
      self.browserManager.connectToPeer(identifierString, syncValue: syncValue) {
        [weak self] syncValue, error, port in
        self?.handleMultiConnectResolved(withSyncValue: syncValue, port: port, error: error)
        if let error = error {
          self?.handleMultiConnectConnectionFailure(withIdentifier: identifierString, error: error)
        }
      }
    } catch let err {
      self.handleMultiConnectResolved(withSyncValue: syncValue, port: nil, error: err)
      return
    }
    return
  }

  public func killConnection(parameters: [AnyObject]) throws {
  }

  public func getIOSVersion() -> String {
    return NSProcessInfo().operatingSystemVersionString
  }

  public func didRegisterToNative(parameters: [AnyObject]) throws {
    guard let functionName = parameters.first as? String else {
      throw AppContextError.badParameters
    }
    if functionName == AppContextJSEvent.networkChanged {
      notifyOnDidUpdateNetworkStatus()
    }
  }

  public func disconnect(parameters: [AnyObject]) throws {
    guard let identifierString = parameters.first as? String else {
      throw AppContextError.badParameters
    }
    if let _ = try? Peer(stringValue: identifierString) {
      browserManager.disconnect(identifierString)
    }
  }

  public func connect(parameters: [AnyObject]) -> String {
    return jsonValue([JSONKey.err.rawValue : AppContextError.connectNotSupported.description])
  }

  #if TEST
  func executeNativeTests() -> String {
    let runner = TestRunner.`default`
    runner.runTest()
    return runner.resultDescription ?? ""
  }
  #endif

}

// MARK: CBCentralManagerDelegate
extension AppContext: CBCentralManagerDelegate {

  public func centralManagerDidUpdateState(central: CBCentralManager) {
    switch central.state {
    case .PoweredOn:
      bluetoothState = .on
      bluetoothLowEnergyState = .on
      #if TEST
        NSNotificationCenter.defaultCenter().postNotificationName(
          Constants.NSNotificationName.centralBluetoothManagerDidChangeState,
          object: self
        )
      #endif
    case .PoweredOff:
      bluetoothState = .off
      bluetoothLowEnergyState = .off
      #if TEST
        NSNotificationCenter.defaultCenter().postNotificationName(
          Constants.NSNotificationName.centralBluetoothManagerDidChangeState,
          object: self
        )
      #endif
    case .Unsupported:
      bluetoothState = .notHere
      bluetoothLowEnergyState = .notHere
    default:
      bluetoothState = .unavailable
      bluetoothLowEnergyState = .unavailable
    }
  }
}

/// Node functions names
@objc public class AppContextJSEvent: NSObject {
  @objc public static let networkChanged: String = "networkChanged"
  @objc public static let peerAvailabilityChanged: String = "peerAvailabilityChanged"
  @objc public static let appEnteringBackground: String = "appEnteringBackground"
  @objc public static let appEnteredForeground: String = "appEnteredForeground"
  @objc public static let discoveryAdvertisingStateUpdateNonTCP: String =
  "discoveryAdvertisingStateUpdateNonTCP"
  @objc public static let incomingConnectionToPortNumberFailed: String =
  "incomingConnectionToPortNumberFailed"
  @objc public static let executeNativeTests: String = "executeNativeTests"
  @objc public static let getOSVersion: String = "getOSVersion"
  @objc public static let didRegisterToNative: String = "didRegisterToNative"
  @objc public static let killConnections: String = "killConnections"
  @objc public static let connect: String = "connect"
  @objc public static let multiConnect: String = "multiConnect"
  @objc public static let multiConnectResolved: String = "multiConnectResolved"
  @objc public static let multiConnectConnectionFailure: String = "multiConnectConnectionFailure"
  @objc public static let stopAdvertisingAndListening: String = "stopAdvertisingAndListening"
  @objc public static let startUpdateAdvertisingAndListening: String =
  "startUpdateAdvertisingAndListening"
  @objc public static let stopListeningForAdvertisements: String =
  "stopListeningForAdvertisements"
  @objc public static let startListeningForAdvertisements: String =
  "startListeningForAdvertisements"
  @objc public static let disconnect: String = "disconnect"
}

func errorDescription(error: ErrorType) -> String {
  if let thaliCoreError = error as? ThaliCoreError {
    return thaliCoreError.rawValue
  }
  return (error as NSError).localizedDescription
}
