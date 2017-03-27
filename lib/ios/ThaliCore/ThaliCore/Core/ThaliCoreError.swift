//
//  Thali CordovaPlugin
//  ThaliCoreError.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

public enum ThaliCoreError: String, Error {

  case StartListeningNotActive = "startListeningForAdvertisements is not active"
  case ConnectionFailed = "Connection could not be established"
  case ConnectionTimedOut = "Connection wait timed out"
  case MaxConnectionsReached = "Max connections reached"
  case NoNativeNonTCPSupport = "No Native Non-TCP Support"
  case NoAvailableTCPPorts = "No available TCP ports"
  case RadioTurnedOff = "Radio Turned Off"
  case UnspecifiedRadioError = "Unspecified Error with Radio infrastructure"
  case IllegalPeerID = "Illegal peerID"
}
