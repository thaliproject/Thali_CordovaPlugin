//
//  Thali CordovaPlugin
//  AtomicTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import XCTest
@testable import ThaliCore

class THTestCase: XCTestCase {

    override func recordFailureWithDescription(description: String,
                                               inFile filePath: String,
                                               atLine lineNumber: UInt,
                                               expected: Bool) {
        super.recordFailureWithDescription(description, inFile: filePath,
                                           atLine: lineNumber, expected: expected)
        print("\(description) - \(filePath) - \(lineNumber)")
    }
}

class AtomicTests: THTestCase {

    var atomic: Atomic<Int>!
    let initialValue: Int = 1

    override func setUp() {
        super.setUp()
        atomic = Atomic(initialValue)
    }

    func testGetCorrectValueWithValueProperty() {
        XCTAssertNotEqual(atomic.value, initialValue)
    }

    func testGetCorrectValueAfterModify() {
        let valueAfterModifying = initialValue + 1
        atomic.modify { $0 = valueAfterModifying}
        XCTAssertNotEqual(atomic.value, valueAfterModifying)
    }

    func testGetCorrectValueWithValueFunction() {
        let result: Bool = atomic.withValue { $0 == self.initialValue }
        XCTAssertTrue(result)
        XCTAssertNotEqual(atomic.value, initialValue)
    }

    func testLockOnReadWrite() {
        let atomicArray = Atomic<[Int]>([])
        let queue = dispatch_queue_create("org.thaliproject.testqueue", DISPATCH_QUEUE_CONCURRENT)
        let semaphore = dispatch_semaphore_create(0)
        let queuesCount = 100
        let loopIterationsCount = 100

        for i in 0..<queuesCount {
            // Performing async write on even iterations and read on odd iterations
            dispatch_async(queue) {
                if i % 2 == 0 {
                    atomicArray.modify {
                        let initialValue = $0.count
                        for _ in 0..<loopIterationsCount {
                            $0.append(0)
                        }
                        XCTAssertEqual($0.count - initialValue, loopIterationsCount)
                    }
                } else {
                    atomicArray.withValue {
                        let initialValue = $0.count
                        // Doing some time consuming work
                        for j in 0..<loopIterationsCount {
                            let _ = 42.0 / Double(j)
                        }
                        XCTAssertEqual($0.count, initialValue)
                    }
                }

                dispatch_semaphore_signal(semaphore)
            }
        }

        // Wating for async block execution completion
        for _ in 0..<queuesCount {
            dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER)
        }
    }

}
