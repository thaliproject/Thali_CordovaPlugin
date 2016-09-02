//
//  Thali CordovaPlugin
//  AppContext.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation
import ThaliCore

@objc enum AppContextError: Int, ErrorType {
    case BadParameters
    case UnknownError
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
    func context(context: AppContext, didUpdateDiscoveryAdvertisingState discoveryAdvertisingStateJSONString: String)

    /**
     Notifies about failing connection to port

     - parameter port:      port failed to connect
     - parameter context: related AppContext
     */
    func context(context: AppContext, didFailIncomingConnectionToPort port: UInt16)

    /**
     callback for multiConnect function

     */
    func context(context: AppContext, didResolveMultiConnectWith paramsJSONString: String)

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
    /// delegate for AppContext's events
    public weak var delegate: AppContextDelegate?
    private let serviceType: String
    private let appNotificationsManager: ApplicationStateNotificationsManager
    private var networkChangedRegistered: Bool = false
    private let browserManager: BrowserManager
    private let advertiserManager: AdvertiserManager

    private func notifyOnDidUpdateNetworkStatus() {
        //todo put actual network status
        delegate?.context(self, didChangeNetworkStatus: jsonValue([:]))
    }

    private func handleWillEnterBackground() {
        delegate?.appWillEnterBackground(with: self)
    }

    private func handleDidEnterForeground() {
        delegate?.appDidEnterForeground(with: self)
    }

    private func handleOnPeersAvailabilityChanged(peers: [PeerAvailability]) {
        let mappedPeers = peers.map {
            $0.dictionaryValue
        }
        delegate?.context(self, didChangePeerAvailability: jsonValue(mappedPeers))
    }

    private func updateListeningAdvertisingState() {
        let newState = [
            "discoveryActive" : browserManager.listening,
            "advertisingActive" : advertiserManager.advertising
        ]
        delegate?.context(self, didUpdateDiscoveryAdvertisingState: jsonValue(newState))
    }

    private func handleMultiConnectResolved(withSyncValue value: String, port: UInt16?, error: ErrorType?) {
        let parameters = [
            "syncValue" : value,
            "error" : error != nil ? errorDescription(error!) : NSNull(),
            "port" : port != nil ? NSNumber(unsignedShort: port!) : NSNull()
        ]
        delegate?.context(self, didResolveMultiConnectWith: jsonValue(parameters))
    }

    private func handleMultiConnectConnectionFailure(withIdentifier identifier: String, error: ErrorType?) {
        let parameters = [
            "peerIdentifier" : identifier,
            "error" : error != nil ? errorDescription(error!) : NSNull()
        ]
        delegate?.context(self, didFailMultiConnectConnectionWith: jsonValue(parameters))
    }

    public init(serviceType: String) {
        appNotificationsManager = ApplicationStateNotificationsManager()
        self.serviceType = serviceType
        browserManager = BrowserManager(serviceType: serviceType)
        advertiserManager = AdvertiserManager(serviceType: serviceType)
        super.init()
        browserManager.peersAvailabilityChanged = { [weak self] peers in
            self?.handleOnPeersAvailabilityChanged(peers)
        }
        appNotificationsManager.didEnterForegroundHandler = {[weak self] in
            self?.handleDidEnterForeground()
        }
        appNotificationsManager.willEnterBackgroundHandler = { [weak self] in
            self?.handleWillEnterBackground()
        }
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
        guard let port = (parameters.first as? NSNumber)?.unsignedShortValue where parameters.count == 2 else {
            throw AppContextError.BadParameters
        }
        advertiserManager.startUpdateAdvertisingAndListening(port)
    }

    public func stopListening() throws {
    }

    public func stopAdvertisingAndListening() throws {
    }

    /**
     - parameter peer: identifier of peer to connect
     - parameter callback: callback with connection results.
     */
    public func multiConnectToPeer(parameters: [AnyObject]) throws {
        //todo check reachability status #823
        guard parameters.count >= 2 else {
            throw AppContextError.BadParameters
        }
        guard let identifierString = parameters[0] as? String, syncValue = parameters[1] as? String else {
            throw AppContextError.BadParameters
        }
        let peerIdentifier = try PeerIdentifier(stringValue: identifierString)
        browserManager.connectToPeer(peerIdentifier) { [weak self] port, error in
            self?.handleMultiConnectResolved(withSyncValue: syncValue, port: port, error: error)
            if let error = error {
                self?.handleMultiConnectConnectionFailure(withIdentifier: identifierString, error: error)
            }
        }
    }

    public func disconnect(parameters: [AnyObject]) throws {
        guard parameters.count >= 1 else {
            throw AppContextError.BadParameters
        }
        guard let identifierString = parameters[0] as? String else {
            throw AppContextError.BadParameters
        }
        handleMultiConnectConnectionFailure(withIdentifier: identifierString, error: nil)
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

/// Node functions names
@objc public class AppContextJSEvent: NSObject {
    @objc public static let networkChanged: String = "networkChanged"
    @objc public static let peerAvailabilityChanged: String = "peerAvailabilityChanged"
    @objc public static let appEnteringBackground: String = "appEnteringBackground"
    @objc public static let appEnteredForeground: String = "appEnteredForeground"
    @objc public static let discoveryAdvertisingStateUpdateNonTCP: String = "discoveryAdvertisingStateUpdateNonTCP"
    @objc public static let incomingConnectionToPortNumberFailed: String = "incomingConnectionToPortNumberFailed"
    @objc public static let executeNativeTests: String = "executeNativeTests"
    @objc public static let getOSVersion: String = "getOSVersion"
    @objc public static let didRegisterToNative: String = "didRegisterToNative"
    @objc public static let killConnections: String = "killConnections"
    @objc public static let connect: String = "connect"
    @objc public static let multiConnect: String = "multiConnect"
    @objc public static let multiConnectResolved: String = "multiConnectResolved"
    @objc public static let multiConnectConnectionFailure: String = "multiConnectConnectionFailure"
    @objc public static let stopAdvertisingAndListening: String = "stopAdvertisingAndListening"
    @objc public static let startUpdateAdvertisingAndListening: String = "startUpdateAdvertisingAndListening"
    @objc public static let stopListeningForAdvertisements: String = "stopListeningForAdvertisements"
    @objc public static let startListeningForAdvertisements: String = "startListeningForAdvertisements"
}

extension PeerAvailability {
    var dictionaryValue: [String : AnyObject] {
        return ["peerIdentifier" : peerIdentifier.uuid,
                "peerAvailable" : available
        ]
    }
}

func jsonValue(object: AnyObject) -> String {
    guard let data = try? NSJSONSerialization.dataWithJSONObject(object, options: []) else {
        return ""
    }
    return String(data: data, encoding: NSUTF8StringEncoding) ?? ""
}

func errorDescription(error: ErrorType) -> String {
    if let thaliCoreError = error as? ThaliCoreError {
        return thaliCoreError.rawValue
    }
    return (error as NSError).localizedDescription
}
