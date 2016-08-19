//
//  Thali CordovaPlugin
//  AppContext.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation
import ThaliCore

func jsonValue(object: AnyObject) throws -> String? {
    let data = try NSJSONSerialization.dataWithJSONObject(object, options: NSJSONWritingOptions(rawValue:0))
    return String(data: data, encoding: NSUTF8StringEncoding)
}

public typealias ClientConnectCallback = (String, String) -> Void

@objc public enum AppContextError: Int, ErrorType{
    case BadParameters
    case UnknownError
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
    /// delegate for AppContext's events
    public weak var delegate: AppContextDelegate?
    private let appNotificationsManager: ApplicationStateNotificationsManager
    private var networkChangedRegistered: Bool = false

    private func updateNetworkStatus() {
        //todo put actual network status
        do {
            delegate?.context(self, didChangeNetworkStatus: try jsonValue([:])!)
        } catch _ {
        }
    }

    public override init() {
        appNotificationsManager = ApplicationStateNotificationsManager()
        super.init()
        appNotificationsManager.didEnterForegroundHandler = { [weak self] in
            guard let strongSelf = self else {
                return
            }
            strongSelf.delegate?.appDidEnterForeground(withContext: strongSelf)
        }
        appNotificationsManager.willEnterBackgroundHandler = { [weak self] in
            guard let strongSelf = self else {
                return
            }
            strongSelf.delegate?.appWillEnterBackground(withContext: strongSelf)
        }
    }

    public func startListeningForAdvertisements() throws {
    }

    public func stopListeningForAdvertisements() throws {
    }

    public func startUpdateAdvertisingAndListening(withParameters parameters: [AnyObject]) throws {
        guard let _ = (parameters.first as? NSNumber)?.unsignedShortValue where parameters.count == 2 else {
            throw AppContextError.BadParameters
        }
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
        if functionName == AppContext.networkChanged() {
            updateNetworkStatus()
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
extension AppContext {
    @objc public class func networkChanged() -> String {
        return "networkChanged"
    }

    @objc public class func peerAvailabilityChanged() -> String {
        return "peerAvailabilityChanged"
    }

    @objc public class func appEnteringBackground() -> String {
        return "appEnteringBackground"
    }

    @objc public class func appEnteredForeground() -> String {
        return "appEnteredForeground"
    }

    @objc public class func discoveryAdvertisingStateUpdateNonTCP() -> String {
        return "discoveryAdvertisingStateUpdateNonTCP"
    }

    @objc public class func incomingConnectionToPortNumberFailed() -> String {
        return "incomingConnectionToPortNumberFailed"
    }

    @objc public class func executeNativeTests() -> String {
        return "executeNativeTests"
    }

    @objc public class func getOSVersion() -> String {
        return "getOSVersion"
    }

    @objc public class func didRegisterToNative() -> String {
        return "didRegisterToNative"
    }

    @objc public class func killConnections() -> String {
        return "killConnections"
    }

    @objc public class func connect() -> String {
        return "connect"
    }

    @objc public class func stopAdvertisingAndListening() -> String {
        return "stopAdvertisingAndListening"
    }

    @objc public class func startUpdateAdvertisingAndListening() -> String {
        return "startUpdateAdvertisingAndListening"
    }

    @objc public class func stopListeningForAdvertisements() -> String {
        return "stopListeningForAdvertisements"
    }

    @objc public class func startListeningForAdvertisements() -> String {
        return "startListeningForAdvertisements"
    }
}
