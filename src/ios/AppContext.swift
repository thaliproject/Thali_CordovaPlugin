//
//  Thali CordovaPlugin
//  AppContext.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import CoreBluetooth
import Foundation
import ThaliCore

enum JSONValueKey: String {
    case PeerIdentifier = "peerIdentifier"
    case Generation = "generation"
    case PeerAvailable = "peerAvailable"

    case DiscoveryActive = "discoveryActive"
    case AdvertisingActive = "advertisingActive"
}

func jsonValue(object: AnyObject) -> String {

    guard
        let data = try? NSJSONSerialization.dataWithJSONObject(
            object,
            options: NSJSONWritingOptions(rawValue:0)
        ) else {
            return ""
    }
    return String(data: data, encoding: NSUTF8StringEncoding) ?? ""
}

public typealias ClientConnectCallback = (String, String) -> Void

@objc public enum AppContextError: Int, ErrorType {
    case BadParameters
    case UnknownError
}

extension PeerAvailability {

    var dictionaryValue: [String : AnyObject] {
        return [ JSONValueKey.PeerIdentifier.rawValue : peerIdentifier.uuid,
                 JSONValueKey.Generation.rawValue : peerIdentifier.generation,
                 JSONValueKey.PeerAvailable.rawValue : available
        ]
    }
}

@objc public protocol AppContextDelegate: class, NSObjectProtocol {
    /**
     Notifies about context's peer changes

     - parameter peers:   json with data about changed peers
     - parameter context: related AppContext
     */
    func context(context: AppContext, didChangePeerAvailability peers: String)

    /**
     Notifies about network status changes

     - parameter status:  json string with network availability status
     - parameter context: related AppContext
     */
    func context(context: AppContext, didChangeNetworkStatus status: String)

    /**
     Notifies about peer advertisement update

     - parameter discoveryAdvertisingState: json with information about peer's state
     - parameter context:                   related AppContext
     */
    func context(context: AppContext,
                 didUpdateDiscoveryAdvertisingState discoveryAdvertisingState: String)

    /**
     Notifies about failing connection to port

     - parameter port:      port failed to connect
     - parameter context: related AppContext
     */
    func context(context: AppContext, didFailIncomingConnectionToPort port: UInt16)

    /**
     Notifies about entering background

     - parameter context: related AppContext
     */
    func appWillEnterBackground(withContext context: AppContext)

    /**
     Notifies about entering foreground

     - parameter context: related AppContext
     */
    func appDidEnterForeground(withContext context: AppContext)
}

/// Interface for communication between native and cross-platform parts
@objc public final class AppContext: NSObject {
    /// delegate for AppContext's events
    public weak var delegate: AppContextDelegate?
    private let serviceType: String
    private let appNotificationsManager: ApplicationStateNotificationsManager
    private var networkChangedRegistered: Bool = false
    private let browserManager: BrowserManager
    private let advertiserManager: AdvertiserManager
    
    private var bluetoothManager: CBCentralManager?

    private func notifyOnDidUpdateNetworkStatus() {

        enum RadioState: String {
            case On = "on"
            case Off = "off"
            case Unavailable = "unavailable"
            case NotHere = "notHere"
            case DoNotCare = "doNotCare"
        }
        
        var bluetoothState = RadioState.Unavailable
        var bluetoothLowEnergyState = RadioState.Unavailable
        var wifiState = RadioState.Unavailable
        let cellularState = RadioState.DoNotCare
        
        if (nil != bluetoothManager) {
            switch bluetoothManager!.state {
            case .PoweredOn:
                bluetoothState = .On
                bluetoothLowEnergyState = .On
            case .PoweredOff:
                bluetoothState = .Off
                bluetoothLowEnergyState = .Off
            case .Unsupported:
                bluetoothState = .NotHere
                bluetoothLowEnergyState = .NotHere
            default:
                bluetoothState = .Unavailable
                bluetoothLowEnergyState = .Unavailable
            }
        }
        
        let wifiEnabled = NetworkReachability().isWiFiEnabled()
        
        wifiState = wifiEnabled ? .On : .Off
        
        let networkStatus = [
            "wifi"              : wifiState.rawValue,
            "bluetooth"         : bluetoothState.rawValue,
            "bluetoothLowEnergy": bluetoothLowEnergyState.rawValue,
            "cellular"          : cellularState.rawValue
        ]


        delegate?.context(self, didChangeNetworkStatus: jsonValue(networkStatus)!)
    }

    private func willEnterBackground() {
        delegate?.appWillEnterBackground(withContext: self)
    }

    private func didEnterForeground() {
        delegate?.appDidEnterForeground(withContext: self)
    }

    private func peersAvailabilityChanged(peers: [PeerAvailability]) {
        let mappedPeers = peers.map {
            $0.dictionaryValue
        }
        delegate?.context(self, didChangePeerAvailability: jsonValue(mappedPeers))
    }

    private func updateListeningAdvertisingState() {
        let newState = [
                JSONValueKey.DiscoveryActive.rawValue : browserManager.isListening,
                JSONValueKey.AdvertisingActive.rawValue : advertiserManager.advertising
        ]
        delegate?.context(self, didUpdateDiscoveryAdvertisingState: jsonValue(newState))
    }

    public init(serviceType: String) {
        appNotificationsManager = ApplicationStateNotificationsManager()
        self.serviceType = serviceType
        browserManager = BrowserManager(serviceType: serviceType)
        advertiserManager = AdvertiserManager(serviceType: serviceType)
        super.init()
        browserManager.peersAvailabilityChanged = { [weak self] peers in
            self?.peersAvailabilityChanged(peers)
        }
        appNotificationsManager.didEnterForegroundHandler = {[weak self] in
            self?.willEnterBackground()
        }
        appNotificationsManager.willEnterBackgroundHandler = { [weak self] in
            self?.willEnterBackground()
        }
        
        bluetoothManager = CBCentralManager(delegate: self, queue: nil)
    }

    public func startListeningForAdvertisements() throws {
        browserManager.startListeningForAdvertisements()
        updateListeningAdvertisingState()
    }

    public func stopListeningForAdvertisements() throws {
        browserManager.stopListeningForAdvertisements()
        updateListeningAdvertisingState()
    }

    public func startUpdateAdvertisingAndListening(withParameters parameters: [AnyObject]) throws {
        guard
            let port = (parameters.first as? NSNumber)?.unsignedShortValue
            where parameters.count == 2 else {
                throw AppContextError.BadParameters
        }
        advertiserManager.startUpdateAdvertisingAndListening(port)
    }

    public func stopListening() throws {
    }

    public func stopAdvertisingAndListening() throws {
    }

    public func multiConnectToPeer(parameters: [AnyObject]) throws {

    }

    public func killConnection(parameters: [AnyObject]) throws {
    }

    public func getIOSVersion() -> String {
        return NSProcessInfo().operatingSystemVersionString
    }

    public func didRegisterToNative(parameters: [AnyObject]) throws {
        guard let functionName = parameters.first as? String where parameters.count == 2 else {
            throw AppContextError.BadParameters
        }
        if functionName == AppContextJSEvent.networkChanged {
            notifyOnDidUpdateNetworkStatus()
        }
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
    public func centralManagerDidUpdateState(central: CBCentralManager) {}
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
    @objc public static let stopAdvertisingAndListening: String =
        "stopAdvertisingAndListening"
    @objc public static let startUpdateAdvertisingAndListening: String =
        "startUpdateAdvertisingAndListening"
    @objc public static let stopListeningForAdvertisements: String =
        "stopListeningForAdvertisements"
    @objc public static let startListeningForAdvertisements: String =
        "startListeningForAdvertisements"
}
