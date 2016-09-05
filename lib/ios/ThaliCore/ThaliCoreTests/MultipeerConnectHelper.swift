//
//  Thali CordovaPlugin
//  MultipeerConnectHelper.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license
//  information.
//

import Foundation
@testable import ThaliCore

func createMCPFConnection(advertiserIdentifier identifier: PeerIdentifier,
                                               advertiserSessionHandler: (Session) -> Void,
                          completion: () -> Void) -> (Advertiser, Browser) {
    let serviceType = String.random(length: 7)

    let browser = Browser(serviceType: serviceType, foundPeer: { identifier in
        completion()
        }, lostPeer: { _ in })
    browser.startListening()
    let advertiser = Advertiser(peerIdentifier: identifier,
                                serviceType: serviceType,
                                receivedInvitationHandler: advertiserSessionHandler,
                                disconnectHandler: {})
    advertiser.startAdvertising()
    return (advertiser, browser)
}
