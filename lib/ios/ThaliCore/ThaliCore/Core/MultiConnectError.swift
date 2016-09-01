//
//  Thali CordovaPlugin
//  MultiConnectError.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

public enum MultiConnectError: ErrorType {
    case StartListeningNotActive
    case ConnectionFailed
    case ConnectionTimedOut
    case MaxConnectionsReached
    case NoNativeNonTCPSupport
    case NoAvailableTCPPorts
    case RadioTurnedOffMultiConnectError
    case UnspecifiedRadioError
    case IllegalPeerID
}

extension MultiConnectError: CustomStringConvertible {
    public var description: String {
        switch self {
        case .StartListeningNotActive:
            return "startListeningForAdvertisements is not active"
        case .ConnectionFailed:
            return "Connection could not be established"
        case .ConnectionTimedOut:
            return "Connection wait timed out"
        case .MaxConnectionsReached:
            return "Max connections reached"
        case .NoNativeNonTCPSupport:
            return "No Native Non-TCP Support"
        case .NoAvailableTCPPorts:
            return "No available TCP ports"
        case .RadioTurnedOffMultiConnectError:
            return "Radio Turned Off"
        case .UnspecifiedRadioError:
            return "Unspecified Error with Radio infrastructure"
        case .IllegalPeerID:
            return "Illegal peerID"
        }
    }
}
