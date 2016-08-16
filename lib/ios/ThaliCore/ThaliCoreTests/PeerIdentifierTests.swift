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

    func testInitWithString() {
        let uuid = "uuid"
        let gen = 0
        let string = "\(uuid):\(String(gen, radix: 16))"
        let peer = (try? PeerIdentifier(stringValue: string))!
        XCTAssertEqual(uuid, peer.uuid)
        XCTAssertEqual(gen, peer.generation)
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
        XCTAssertEqual(parsingError, .WrongDataFormat)

        let string2 = "eqwer:not_a_number"
        parsingError = nil
        do {
            let _ = try PeerIdentifier(stringValue: string2)
        } catch let peerErr as PeerIdentifierError {
            parsingError = peerErr
        } catch _ {
        }
        XCTAssertEqual(parsingError, .WrongDataFormat)
    }
}
