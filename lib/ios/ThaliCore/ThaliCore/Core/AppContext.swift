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

public typealias ClientConnectCallback = (String, [String : AnyObject]) -> Void

@objc public protocol AppContextDelegate: class, NSObjectProtocol {
    func peerAviabilityChanged(peers: Array<[String : AnyObject]>, inContext context: AppContext)
    func networkStatusChanged(status: [String : AnyObject], inContext context: AppContext)
    func discoveryAdvertisingStateUpdate(discoveryAdvertisingState: [String : AnyObject], inContext context: AppContext)
    func incomingConnectionFailed(toPort port: UInt16, inContext: AppContext)
    
    func appEnteringBackground(context: AppContext)
    func appEnteredForeground(context: AppContext)
}

@objc public final class AppContext: NSObject {
    public var delegate: AppContextDelegate?
    
    override init() {
        super.init()
    }
    
    /// Start the client components
    public func startListeningForAdvertisements() -> Bool {
        return false
    }
    
    /// Stop the client components
    public func stopListeningForAdvertisements() -> Bool {
        return false
    }
    
    /// Start the server components
    public func startUpdateAdvertisingAndListening(withServerPort port: UInt16) -> Bool {
        return false
    }

    /// Stop the client components
    public func stopListening() -> Bool {
        return false
    }
    
    /// Stop the server components
    public func stopAdvertising() -> Bool {
        return false
    }
    
    /// Kill connection without cleanup - Testing only !!
    public func killConnections() -> Bool {
        return false
    }
}