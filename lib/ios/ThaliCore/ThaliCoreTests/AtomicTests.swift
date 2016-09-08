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
    let initialValue: Int = 1

    override func setUp() {
        super.setUp()
        atomic = Atomic(initialValue)
    }

    func testReadValue() {
        XCTAssertEqual(atomic.value, initialValue)
    }

    func testModify() {
        let valueAfterModifying = initialValue + 1
        atomic.modify { $0 = valueAfterModifying}
        XCTAssertEqual(atomic.value, valueAfterModifying)
    }

    func testWithValue() {
        let result: Bool = atomic.withValue { $0 == self.initialValue }
        XCTAssertTrue(result)
        XCTAssertEqual(atomic.value, initialValue)
    }
}
