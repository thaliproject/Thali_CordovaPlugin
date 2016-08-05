//
//  Thali CordovaPlugin
//  MultipeerContextTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import XCTest
@testable import ThaliCore

class MultipeerContextTests: XCTestCase {
    
    func testInit() {
        let localPeer = PeerIdentifier()
        let remotePeer = PeerIdentifier()
        let context = MultipeerContext(remotePeerIdentifier: remotePeer, localPeerIdentifier: localPeer)
        let data = context.stringValue.dataUsingEncoding(NSUTF8StringEncoding)
        let parsedContext = try! MultipeerContext(data: data)
        XCTAssertEqual(parsedContext.remotePeerIdentifier.stringValue, context.remotePeerIdentifier.stringValue)
        XCTAssertEqual(parsedContext.localPeerIdentifier.stringValue, context.localPeerIdentifier.stringValue)
    }
    
    func testReverse() {
        let localPeer = PeerIdentifier()
        let remotePeer = PeerIdentifier()
        let context = MultipeerContext(remotePeerIdentifier: remotePeer, localPeerIdentifier: localPeer)
        let reversed = context.reversed()
        XCTAssertEqual(reversed.localPeerIdentifier.stringValue, context.remotePeerIdentifier.stringValue)
        XCTAssertEqual(reversed.remotePeerIdentifier.stringValue, context.localPeerIdentifier.stringValue)
    }
    
    func testWrongData() {
        let data = "12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890".dataUsingEncoding(NSUTF8StringEncoding)
        var error: ContextError?
        do {
            let _ = try MultipeerContext(data: data)
        } catch let contextError as ContextError {
            error = contextError
        } catch _ {
        }
        XCTAssertEqual(error, .MalformedData)
        
        let data2 = "wrong data format".dataUsingEncoding(NSUTF8StringEncoding)
        error = nil
        do {
            let _ = try MultipeerContext(data: data2)
        } catch let contextError as ContextError {
            error = contextError
        } catch _ {
        }
        XCTAssertEqual(error, .ParsingError)

    }
    
}