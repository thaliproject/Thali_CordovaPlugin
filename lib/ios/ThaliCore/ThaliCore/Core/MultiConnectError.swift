//
//  Thali CordovaPlugin
//  MultiConnectError.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
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
