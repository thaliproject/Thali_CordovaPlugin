//
//  Thali CordovaPlugin
//  AppContext.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation
import ThaliCore

func jsonValue(object: AnyObject) -> String {
    guard let data = try? NSJSONSerialization.dataWithJSONObject(object, options:
        NSJSONWritingOptions(rawValue:0)) else {
        return ""
    }
    return String(data: data, encoding: NSUTF8StringEncoding) ?? ""
}

@objc public enum AppContextError: Int, ErrorType{
    case BadParameters
    case UnknownError
}

extension PeerAvailability {
    var dictionaryValue: [String : AnyObject] {
        return ["peerIdentifier" : peerIdentifier.uuid,
                "peerAvailable" : available
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
    func context(context: AppContext, didUpdateDiscoveryAdvertisingState discoveryAdvertisingState: String)

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
    private let disposeAdvertiserTimeout = 30.0
    private let inputStreamReceiveTimeout = 5.0

    private let serviceType: String
    private let appNotificationsManager: ApplicationStateNotificationsManager

    private var networkChangedRegistered: Bool = false
    public weak var delegate: AppContextDelegate?
    lazy private var browserManager: BrowserManager = { [unowned self] in
         return BrowserManager(serviceType: self.serviceType,
                 inputStreamReceiveTimeout: self.inputStreamReceiveTimeout) { peers in
            self.peersAvailabilityChanged(peers)
        }
    }()
    private let advertiserManager: AdvertiserManager
    

    private func notifyOnDidUpdateNetworkStatus() {
        //todo put actual network status
        delegate?.context(self, didChangeNetworkStatus: jsonValue([:]))
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
            "discoveryActive" : browserManager.listening,
            "advertisingActive" : advertiserManager.advertising
        ]
        delegate?.context(self, didUpdateDiscoveryAdvertisingState: jsonValue(newState))
    }

    public init(serviceType: String) {
        appNotificationsManager = ApplicationStateNotificationsManager()
        self.serviceType = serviceType
        advertiserManager = AdvertiserManager(serviceType: serviceType,
                                              disposeAdvertiserTimeout: disposeAdvertiserTimeout,
                                              inputStreamReceiveTimeout: inputStreamReceiveTimeout)
        super.init()
        appNotificationsManager.didEnterForegroundHandler = {[weak self] in
            self?.willEnterBackground()
        }
        appNotificationsManager.willEnterBackgroundHandler = { [weak self] in
            self?.willEnterBackground()
        }
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
            throw AppContextError.BadParameters
        }
        advertiserManager.startUpdateAdvertisingAndListening(port) { [weak self] error in
            print("failed start advertising due the error \(error)")
            self?.updateListeningAdvertisingState()
        }
        updateListeningAdvertisingState()
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
        guard parameters.count == 3 else {
            throw AppContextError.BadParameters
        }
        guard let identifierString = parameters[0] as? String, syncValue = parameters[1] as? String
            else {
            throw AppContextError.BadParameters
        }
        let peerIdentifier = try PeerIdentifier(stringValue: identifierString)
        browserManager.connectToPeer(peerIdentifier) { port, error in
            print(syncValue)
            //todo call multiconnectResolved with port or error
        }
    }

    public func killConnection(parameters: [AnyObject]) throws {
    }

    public func getIOSVersion() -> String {
        return NSProcessInfo().operatingSystemVersionString
    }

    public func didRegisterToNative(parameters: [AnyObject]) throws {
        guard let functionName = parameters.first as? String else {
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
    @objc public static let stopAdvertisingAndListening: String = "stopAdvertisingAndListening"
    @objc public static let startUpdateAdvertisingAndListening: String = "startUpdateAdvertisingAndListening"
    @objc public static let stopListeningForAdvertisements: String = "stopListeningForAdvertisements"
    @objc public static let startListeningForAdvertisements: String = "startListeningForAdvertisements"
}
