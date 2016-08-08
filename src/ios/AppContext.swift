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
    func peerAvailabilityChanged(peers: Array<[String : AnyObject]>, inContext context: AppContext)
    
    /**
     Notifies about network status changes
     
     - parameter status:  dictionary with current network availability status
     - parameter context: related AppContext
     */
    func networkStatusChanged(status: [String : AnyObject], inContext context: AppContext)
    
    /**
     Notifies about peer advertisement update
     
     - parameter discoveryAdvertisingState: dictionary with information about peer's state
     - parameter context:                   related AppContext
     */
    func discoveryAdvertisingStateUpdate(discoveryAdvertisingState: [String : AnyObject], inContext context: AppContext)
    
    /**
     Notifies about failing connection to port
     
     - parameter port:      port failed to connect
     - parameter context: related AppContext
     */
    func incomingConnectionFailed(toPort port: UInt16, inContext context: AppContext)
    
    /**
     Notifies about entering background
     
     - parameter context: related AppContext
     */
    func appWillEnterBackground(context: AppContext)
    
    /**
     Notifies about entering foreground
     
     - parameter context: related AppContext
     */
    func appDidEnterForeground(context: AppContext)
}

/// Interface for communication between native and cross-platform parts
@objc public final class AppContext: NSObject {
    /// delegate for AppContext's events
    private weak var delegate: AppContextDelegate?
    private let appNotificationsManager: ApplicationStateNotificationsManager

    public init(delegate: AppContextDelegate?) {
        appNotificationsManager = ApplicationStateNotificationsManager()
        super.init()
        appNotificationsManager.didEnterForegroundHandler = { [weak self] in
            guard let strongSelf = self else {
                return
            }
            strongSelf.delegate?.appDidEnterForeground(strongSelf)
        }
        appNotificationsManager.willEnterBackgroundHandler = { [weak self] in
            guard let strongSelf = self else {
                return
            }
            strongSelf.delegate?.appWillEnterBackground(strongSelf)
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
    public func stopAdvertising() -> Bool {
        return false
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
}
