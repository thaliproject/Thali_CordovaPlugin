//
//  Thali CordovaPlugin
//  AppContext.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation
import ThaliCore

public typealias ClientConnectCallback = (String, [String : AnyObject]) -> Void

@objc public protocol AppContextDelegate: class, NSObjectProtocol {
    /**
     Notifies about context's peer changes

     - parameter peers:   array of changed peers
     - parameter context: related AppContext
     */
    func context(context: AppContext, didChangePeerAvailability peers: Array<[String : AnyObject]>)

    /**
     Notifies about network status changes

     - parameter status:  dictionary with current network availability status
     - parameter context: related AppContext
     */
    func context(context: AppContext, didChangeNetworkStatus status: [String : AnyObject])

    /**
     Notifies about peer advertisement update

     - parameter discoveryAdvertisingState: dictionary with information about peer's state
     - parameter context:                   related AppContext
     */
    func context(context: AppContext, didUpdateDiscoveryAdvertisingState discoveryAdvertisingState: [String : AnyObject])

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

    /**
     Start the client components

     - returns: true if successful
     */
    public func startListeningForAdvertisements() -> Bool {
        return false
    }

    /**
     Stop the client components

     - returns: true if successful
     */
    public func stopListeningForAdvertisements() -> Bool {
        return false
    }

    /**
     Start the server components

     - parameter port: server port to listen
     - returns: true if successful
     */
    public func startUpdateAdvertisingAndListening(withServerPort port: UInt16) -> Bool {
        return false
    }

    /**
     Stop the client components

     - returns: true if successful
     */
    public func stopListening() -> Bool {
        return false
    }

    /**
     Stop the server components

     - returns: true if successful
     */
    public func stopAdvertisingAndListening() -> Bool {
        return false
    }

    /**
     try to establish connection with peer and open TCP listener

     - parameter peer: identifier of peer to connect
     - parameter callback: callback with connection results.
     */
    public func connectToPeer(peer: String, callback:ClientConnectCallback) {

    }

    /**

     Kill connection without cleanup - Testing only !!

     - parameter peerIdentifier: identifier of peer to kill connection

     - returns: true if successful
     */
    public func killConnection(peerIdentifier: String) -> Bool {
        return false
    }

    /**
     Ask context to update its network status variables
     */
    public func updateNetworkStatus() {
    }

    public func getIOSVersion() -> String {
        return NSProcessInfo().operatingSystemVersionString
    }

#if TEST
    func executeNativeTests() -> String {
        let runner = TestRunner.`default`
        runner.runTest()
        return runner.resultDescription ?? ""
    }
#endif

}
