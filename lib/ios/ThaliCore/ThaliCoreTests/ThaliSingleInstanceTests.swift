//
//  ThaliSingleInstanceTests.swift
//  ThaliCore
//
//  Created by Ilya Laryionau on 7/29/16.
//  Copyright © 2016 Thali. All rights reserved.
//

import Foundation
import XCTest
@testable import ThaliCore

final class ThaliSingleInstanceTests: XCTestCase {
    private var app: THEAppContext?

    override func setUp() {
        super.setUp()

        app = THEAppContext()
    }

    override func tearDown() {
        super.tearDown()

        app = nil
    }

    func testCanStartListening() {
        XCTAssertTrue(app?.startListeningForAdvertisements())
    }

    func testStartListeningTwiceIsAnError() {
        XCTAssertTrue(app?.startListeningForAdvertisements())
        XCTAssertFalse(app?.startListeningForAdvertisements())
    }

    func testStopListeningIsNotAnError() {
        XCTAssertTrue(app?.stopListeningForAdvertisements())
    }

    func testStartAdvertising() {
        XCTAssertTrue(app?.startUpdateAdvertisingAndListening(4242))
    }

    func testStopAdvertisingIsNotAnError() {
        XCTAssertTrue(app?.stopAdvertisingAndListening])
    }

    func testStartAdvertisingTwiceIsNotAnError() {
    XCTAssertTrue(app?.startUpdateAdvertisingAndListening(4242))
    XCTAssertTrue(app?.startUpdateAdvertisingAndListening(4242))
    }

    func testInviteContextLength() {
        let uuid = "\(NSUUID().UUIDString):\(ULLONG_MAX)"
        let contextString = "\(uuid)+\(uuid)"
        let contextData = contextString.dataUsingEncoding(NSUTF8StringEncoding)

        XCTAssertTrue(contextData.length == 115)
    }
}
