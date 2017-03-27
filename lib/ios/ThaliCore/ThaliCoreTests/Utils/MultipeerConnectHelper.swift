//
//  Thali CordovaPlugin
//  MultipeerConnectHelper.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

@testable import ThaliCore
import XCTest

func createMPCFPeers(with browsingCompletion: @escaping (PeerAvailability) -> Void)
                     -> (AdvertiserManager, BrowserManager) {

    let serviceType = String.randomValidServiceType(length: 7)

    let browserManager = BrowserManager(serviceType: serviceType,
                                        inputStreamReceiveTimeout: 5,
                                        peerAvailabilityChanged: {
                                          peerAvailability in
                                          browsingCompletion(peerAvailability.first!)
                                        })
    browserManager.startListeningForAdvertisements(unexpectedErrorHandler)

    let advertiserManager = AdvertiserManager(serviceType: serviceType,
                                              disposeAdvertiserTimeout: 30)
    advertiserManager.startUpdateAdvertisingAndListening(onPort: 0,
                                                         errorHandler: unexpectedErrorHandler)

    return (advertiserManager, browserManager)
}

func unexpectedErrorHandler(_ error: Error) {
  XCTFail("unexpected error: \(error)")
}

func unexpectedConnectHandler() {
  XCTFail("Unexpected connect received")
}

func unexpectedDisconnectHandler() {
  XCTFail("Unexpected disconnect received")
}

func unexpectedReadDataHandler(_ data: Data) {
  XCTFail("Unexpected data readed. Data: \(data)")
}

func unexpectedReadDataHandler(_ socket: GCDAsyncSocket, data: Data) {
  XCTFail("Unexpected data readed on socket \(socket). Data: \(data)")
}

func unexpectedSocketDisconnectHandler(_ socket: GCDAsyncSocket) {
  XCTFail("Unexpected disconnect received on socket \(socket)")
}

func unexpectedStopListeningHandler() {
  XCTFail("Unexpected stopped listening for connections")
}

func unexpectedAcceptConnectionHandler() {
  XCTFail("Unexpected acceptConnection received")
}

func unexpectedAcceptConnectionHandler(_ socket: GCDAsyncSocket) {
  XCTFail("Unexpected acceptConnection received")
}

func unexpectedReceivedSessionHandler(_ session: Session) {
  XCTFail("Unexpected session received: \(session)")
}
