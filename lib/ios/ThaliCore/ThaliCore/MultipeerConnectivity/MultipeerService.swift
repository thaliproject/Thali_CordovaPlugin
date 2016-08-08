//
//  Thali CordovaPlugin
//  MultipeerService.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation

//Protocol describes common interface for Browser and Advertiser
protocol MultipeerService: class {
    var peerIdentifier: PeerIdentifier { get }
    
    /**
     
     - parameter peerIdentifier: peer identifier to advertise/browse
     - parameter serviceType:    service type to advertise/browse
     
     */
    init(peerIdentifier: PeerIdentifier, serviceType: String)

    /**
     Start service
    */
    func start()

    /**
     Stop service
    */
    func stop()
}
