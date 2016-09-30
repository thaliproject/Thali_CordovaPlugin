//
//  Thali CordovaPlugin
//  MultipeerConnectHelper.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import Foundation
import XCTest
@testable import ThaliCore

func createMPCFConnectionWithCompletion(completion: (PeerAvailability) -> Void)
                                        -> (AdvertiserManager, BrowserManager) {

    let serviceType = String.random(length: 7)

    let browserManager = BrowserManager(serviceType: serviceType,
                                        inputStreamReceiveTimeout: 5,
                                        peersAvailabilityChangedHandler: {
                                            peerAvailability in

                                            completion(peerAvailability.first!)
    })
    browserManager.startListeningForAdvertisements(unexpectedErrorHandler)

    let advertiserManager = AdvertiserManager(serviceType: serviceType,
                                              disposeAdvertiserTimeout: 30)
    advertiserManager.startUpdateAdvertisingAndListening(onPort: 0,
                                                         errorHandler: unexpectedErrorHandler)

    return (advertiserManager, browserManager)
}

func unexpectedErrorHandler(error: ErrorType) {
    XCTFail("unexpected error: \(error)")
}

func unexpectedConnectHandler() {
    XCTFail("Unexpected connect received")
}

func unexpectedDisconnectHandler() {
    XCTFail("Unexpected disconnect received")
}

func unexpectedSessionHandler(session: Session) {
    XCTFail("Unexpected session received: \(session)")
}
