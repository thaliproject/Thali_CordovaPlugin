//
//  The MIT License (MIT)
//
//  Copyright (c) 2016 Microsoft
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//  THE SOFTWARE.
//
//  Thali CordovaPlugin
//  AppContext.swift
//

import Foundation
import UIKit

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
    public var delegate: AppContextDelegate?

    @objc private func applicationWillResignActiveNotification(notification: NSNotification) {
        delegate?.appWillEnterBackground(self)
    }

    @objc private func applicationDidBecomeActiveNotification(notification: NSNotification) {
        delegate?.appDidEnterForeground(self)
    }

    private func subscribeAppStateNotifications() {
        let notificationCenter = NSNotificationCenter.defaultCenter()
        notificationCenter.addObserver(self,
                                       selector: #selector(applicationWillResignActiveNotification(_:)),
                                       name: UIApplicationWillResignActiveNotification,
                                       object: nil)
        notificationCenter.addObserver(self,
                                       selector: #selector(applicationDidBecomeActiveNotification(_:)),
                                       name: UIApplicationDidBecomeActiveNotification,
                                       object: nil)
    }

    override public init() {
        super.init()
        subscribeAppStateNotifications()
    }

    deinit {
        NSNotificationCenter.defaultCenter().removeObserver(self)
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
