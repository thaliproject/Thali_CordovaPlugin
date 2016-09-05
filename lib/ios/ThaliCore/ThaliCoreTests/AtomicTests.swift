//
//  AtomicTests.swift
//  ThaliCore
//
//  Created by Alexander Evsyuchenya on 9/5/16.
//  Copyright © 2016 Thali. All rights reserved.
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
