//
//  Thali CordovaPlugin
//  AtomicTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license
//  information.
//

import XCTest
@testable import ThaliCore

class AtomicTests: XCTestCase {
    var atomic: Atomic<Int>!

    override func setUp() {
        super.setUp()
        atomic = Atomic(1)
    }

    func testReadValue() {
        XCTAssertEqual(atomic.value, 1)
    }

    func testModify() {
        atomic.modify { $0 += 1 }
        XCTAssertEqual(atomic.value, 2)
    }

    func testWithValue() {
        let result: Bool = atomic.withValue { $0 == 1 }
        XCTAssertTrue(result)
        XCTAssertEqual(atomic.value, 1)
    }
}
