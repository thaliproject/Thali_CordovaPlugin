//
//  Reachability.swift
//  ThaliCore
//
//  Created by Dersim Davaod on 8/16/16.
//  Copyright © 2016 Thali. All rights reserved.
//

import Foundation
import SystemConfiguration

public enum ReachabilityError: ErrorType {
    case FailedToCreateWithSocketAddress(sockaddr_in)
}


/// Provides a basic information about wifi reachability
public class Reachability: NSObject {

    // MARK: - Private var
    private var reachabilityRef: SCNetworkReachability?

    private var reachabilityFlags: SCNetworkReachabilityFlags {

        guard let reachabilityRef = reachabilityRef else {
            return SCNetworkReachabilityFlags()
        }

        var flags = SCNetworkReachabilityFlags()
        let gotFlags = withUnsafeMutablePointer(&flags) {
            SCNetworkReachabilityGetFlags(reachabilityRef, UnsafeMutablePointer($0))
        }

        if gotFlags {
            return flags
        } else {
            return SCNetworkReachabilityFlags()
        }
    }


    // MARK: - Initialization
    required public init(reachabilityRef: SCNetworkReachability) {
        self.reachabilityRef = reachabilityRef
    }

    public class func reachabilityForLocalWiFi() throws -> Reachability {

        // Creating a reference to the specified local network address.
        // Wwe're using it to monitor the reachability

        var localWifiAddress: sockaddr_in = sockaddr_in(
            sin_len: __uint8_t(0),
            sin_family: sa_family_t(0),
            sin_port: in_port_t(0),
            sin_addr: in_addr(s_addr: 0),
            sin_zero: (0, 0, 0, 0, 0, 0, 0, 0)
        )
        localWifiAddress.sin_len = UInt8(sizeofValue(localWifiAddress))
        localWifiAddress.sin_family = sa_family_t(AF_INET)

        let address: UInt32 = 0xA9FE0000
        localWifiAddress.sin_addr.s_addr = in_addr_t(address.bigEndian)

        guard let ref = withUnsafePointer(
            &localWifiAddress,
            {SCNetworkReachabilityCreateWithAddress(nil, UnsafePointer($0))}
            ) else {
                throw ReachabilityError.FailedToCreateWithSocketAddress(localWifiAddress)
        }

        return Reachability(reachabilityRef: ref)
    }

    /**
     Notifies about wifi reachability
     */
    public func isReachableViaWiFi() -> Bool {

        let flags = reachabilityFlags

        if !flags.contains(.Reachable) {
            return false
        }

        // Avoid cellular false-positive.
        return !flags.contains(.IsWWAN)
    }


    // MARK: Private methods
    private func isReachableWithFlags(flags: SCNetworkReachabilityFlags) -> Bool {

        if !flags.contains(.Reachable) {
            return false
        }

        if flags.contains(.IsWWAN) {
            return false
        }

        return true
    }

    deinit {
        reachabilityRef = nil
    }
}

