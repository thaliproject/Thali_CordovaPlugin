//
//  Thali CordovaPlugin
//  AppContext.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation
import ThaliCore

public typealias ClientConnectCallback = (error: String, info: [String : AnyObject]) -> Void

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
    private let serviceType: String
    private let appNotificationsManager: ApplicationStateNotificationsManager
    private var networkChangedRegistered: Bool = false
    private let browserManager: BrowserManager
    private let advertiserManager: AdvertiserManager
    
    private func updateNetworkStatus() {
        //todo put actual network status
        delegate?.context(self, didChangeNetworkStatus: [:])
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
        delegate?.context(self, didChangePeerAvailability: mappedPeers)
    }
    
    private func updateListeningAdvertisingState() {
        delegate?.context(self, didUpdateDiscoveryAdvertisingState: [
                "discoveryActive" : browserManager.isListening,
                "advertisingActive" : advertiserManager.isAdvertising
            ])
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
    }

    /**
     Start the client components

     - returns: true if successful
     */
    public func startListeningForAdvertisements() -> Bool {
        browserManager.startListeningForAdvertisements()
        updateListeningAdvertisingState()
        return true
    }

    /**
     Stop the client components

     - returns: true if successful
     */
    public func stopListeningForAdvertisements() -> Bool {
        browserManager.stopListeningForAdvertisements()
        updateListeningAdvertisingState()
        return true
    }

    /**
     Start the server components

     - parameter port: server port to listen
     - returns: true if successful
     */
    public func startUpdateAdvertisingAndListening(withServerPort port: UInt16) -> Bool {
        advertiserManager.startUpdateAdvertisingAndListening(port)
        return true
    }

    /**
     Stop the server components

     - returns: true if successful
     */
    public func stopAdvertisingAndListening() -> Bool {
        advertiserManager.stopAdvertising()
        return true
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

    public func getIOSVersion() -> String {
        return NSProcessInfo().operatingSystemVersionString
    }
    
    public func didRegisterToNative(function: String) {
        if function == AppContext.networkChanged() {
            updateNetworkStatus()
        }
    }

#if TEST
    func executeNativeTests() -> String {
        let runner = TestRunner.`default`
        return runner.runTest() ?? ""
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

extension PeerAvailability {
    var dictionaryValue: [String : AnyObject] {
        return ["peerIdentifier" : peerIdentifier.uuid,
                "peerAvailable" : available
            ]
    }
}
