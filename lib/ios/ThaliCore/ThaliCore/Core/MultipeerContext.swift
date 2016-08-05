//
//  Thali CordovaPlugin
//  MultipeerContext.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation

enum ContextError: String, ErrorType {
    case MalformedData
    case ParsingError
}

struct MultipeerContext {
    let remotePeerIdentifier: PeerIdentifier
    let localPeerIdentifier: PeerIdentifier

    init(data: NSData?) throws {
        guard let context = data where context.length <= 115 else {
            throw ContextError.MalformedData
        }
        let partsArray = String(data: context, encoding: NSUTF8StringEncoding)?.characters.split {
            $0 == "+"
        }.map(String.init)
        guard let parts = partsArray where parts.count == 2 else {
            throw ContextError.ParsingError
        }
        localPeerIdentifier = try PeerIdentifier(stringValue: parts[0])
        remotePeerIdentifier = try PeerIdentifier(stringValue: parts[1])
    }
    
    init(remotePeerIdentifier: PeerIdentifier, localPeerIdentifier: PeerIdentifier) {
        self.remotePeerIdentifier = remotePeerIdentifier
        self.localPeerIdentifier = localPeerIdentifier
    }
    
    var stringValue: String {
        return "\(localPeerIdentifier.stringValue)+\(remotePeerIdentifier.stringValue)"
    }
    
    /**
     Reverse local and remote peer identifiers. Useful in cases when you receiving context and in that case 
     remote peer becoming local peer and local peer identifier becomes remote
     
     - returns: context with reversed local and remote peer identifiers
     */
    func reversed() -> MultipeerContext {
        return MultipeerContext(remotePeerIdentifier: localPeerIdentifier, localPeerIdentifier: remotePeerIdentifier)
    }
}
