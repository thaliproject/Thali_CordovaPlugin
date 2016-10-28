//
//  Thali CordovaPlugin
//  AtomicTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import XCTest
import ThaliCore

class AtomicTests: XCTestCase {

  // MARK: - State
  var atomic: Atomic<Int>!
  let initialValue: Int = 1

  // MARK: - Setup & Teardown
  override func setUp() {
    super.setUp()
    atomic = Atomic(initialValue)
  }

  override func tearDown() {
    atomic = nil
    super.tearDown()
  }

  // MARK: - Tests
  func testGetCorrectValueWithValueProperty() {
    XCTAssertEqual(atomic.value, initialValue)
  }

  func testGetCorrectValueAfterModify() {
    let valueAfterModifying = initialValue + 1
    atomic.modify { $0 = valueAfterModifying}
    XCTAssertEqual(atomic.value, valueAfterModifying)
  }

  func testGetCorrectValueWithValueFunction() {
    let result: Bool = atomic.withValue { $0 == self.initialValue }
    XCTAssertTrue(result)
    XCTAssertEqual(atomic.value, initialValue)
  }

  func testLockOnReadWrite() {
    let atomicArray = Atomic<[Int]>([])
    let queue = DispatchQueue(label: "org.thaliproject.testqueue",
                              attributes: DispatchQueue.Attributes.concurrent)
    let semaphore = DispatchSemaphore(value: 0)
    let queuesCount = 100
    let loopIterationsCount = 100

    for i in 0..<queuesCount {
      // Performing async write on even iterations and read on odd iterations
      queue.async {
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
        semaphore.signal()
      }
    }

    // Wating for async block execution completion
    for _ in 0..<queuesCount {
      semaphore.wait(timeout: DispatchTime.distantFuture)
    }
  }
}
