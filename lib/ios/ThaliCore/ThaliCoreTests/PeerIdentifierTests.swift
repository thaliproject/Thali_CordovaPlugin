//
//  Thali CordovaPlugin
//  PeerIdentifierTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import XCTest
@testable import ThaliCore

class PeerIdentifierTests: XCTestCase {

    func testNextGeneration() {
        let peer = PeerIdentifier()
        let nextGenPeer = peer.nextGenerationPeer()
        XCTAssertEqual(peer.uuid, nextGenPeer.uuid)
        XCTAssertEqual(peer.generation, nextGenPeer.generation - 1)
    }

    func testEBNF() {
        for i in 0...0xF {
            let uuid = NSUUID().UUIDString
            let string = "\(uuid):\(String(i, radix: 16))"
            let peer = try? PeerIdentifier(stringValue: string)
            XCTAssertEqual(peer?.uuid, uuid)
            XCTAssertEqual(peer?.generation, i)
        }
    }

    func testWrongFormatString() {
        let string = "eqwer:asdf:aasdf"
        var parsingError: PeerIdentifierError?
        do {
            let _ = try PeerIdentifier(stringValue: string)
        } catch let peerErr as PeerIdentifierError {
            parsingError = peerErr
        } catch _ {
        }
        XCTAssertEqual(parsingError, .IllegalPeerID)

        let string2 = "eqwer:not_a_number"
        parsingError = nil
        do {
            let _ = try PeerIdentifier(stringValue: string2)
        } catch let peerErr as PeerIdentifierError {
            parsingError = peerErr
        } catch _ {
        }
        XCTAssertEqual(parsingError, .IllegalPeerID)
    }

    func testEquality() {
        let p1 = PeerIdentifier()
        let p2 = PeerIdentifier(uuidIdentifier: p1.uuid, generation: p1.generation)
        XCTAssertEqual(p1, p2)

        let p3 = PeerIdentifier(uuidIdentifier: "id\u{E9}ntifi\u{E9}r", generation: 0)
        let p4 = PeerIdentifier(uuidIdentifier: "id\u{65}\u{301}ntifi\u{65}\u{301}r", generation: 0)
        XCTAssertEqual(p3.uuid, p4.uuid)
        XCTAssertNotEqual(p3, p4)
    }

    func testGenerationEquality() {
        let p1 = PeerIdentifier()
        let p2 = PeerIdentifier(uuidIdentifier: p1.uuid, generation: p1.generation + 1)
        XCTAssertNotEqual(p1, p2)
    }
}
