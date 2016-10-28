//
//  Thali CordovaPlugin
//  TestRunner.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license
//  information.
//

import Foundation
import XCTest

public final class TestRunner: NSObject {

  struct RunResult {
    let executedCount: Int
    let succeededCount: Int
    let failureCount: Int
    let duration: TimeInterval
    let executed: Bool
  }

  private let testSuite: XCTestSuite

  private init(testSuite: XCTestSuite) {
    self.testSuite = testSuite
  }

  public static let `default`: TestRunner = TestRunner.createDefaultRunner()

  private static func createDefaultRunner() -> TestRunner {
    return TestRunner(testSuite: XCTestSuite.default())
  }

  public var resultDescription: String? {
    return runResult.jsonString
  }

  var runResult: RunResult {
    // This case isn't obvious, but this is how XCTest.framework is done
    // The reason I see is because XCTest.framework is build on Objective-C
    // when Objective-C doesn't have e.g. generics
    //
    // XCTest has property testRun, when XCTestSuite inherits XCTest
    // so testRun of XCTestSuite can be casted into XCTestSuiteRun accordingly
    guard let testSuiteRun = testSuite.testRun as? XCTestSuiteRun else {
      return TestRunner.RunResult(
        executedCount: 0,
        succeededCount: 0,
        failureCount: 0,
        duration: 0,
        executed: false
      )
    }

    var executedCount = 0
    var succeededCount = 0
    var failureCount = 0
    let duration = testSuite.testRun?.totalDuration ?? 0

    for testRun in testSuiteRun.testRuns {
      executedCount += Int(testRun.executionCount)
      failureCount += Int(testRun.failureCount)
      succeededCount += Int(testRun.executionCount - testRun.failureCount)
    }

    return TestRunner.RunResult(
      executedCount: executedCount,
      succeededCount: succeededCount,
      failureCount: failureCount,
      duration: duration,
      executed: true
    )
  }

  @objc public func runTest() {
    // Test must only be run on the main thread.
    // Please note that it's important not using GCD, because XCTest.framework doesn't use GCD
    if !Thread.current.isMainThread {
      performSelector(onMainThread: #selector(runTest), with: nil, waitUntilDone: true)
      return
    }
    XCTestObservationCenter.shared().addTestObserver(self)
    testSuite.run()
    XCTestObservationCenter.shared().removeTestObserver(self)
  }
}

// MARK:

extension TestRunner.RunResult {
  var jsonString: String? {
    let jsonDictionary: [String: Any] = [
      "total": executedCount,
      "passed": succeededCount,
      "failed": failureCount,
      "ignored": 0,
      "duration": duration,
      "executed": executed
    ]

    do {
      let jsonData = try JSONSerialization.data(withJSONObject: jsonDictionary, options: [])

      return String(data: jsonData, encoding: String.Encoding.utf8)
    } catch _ as NSError {
      return nil
    }
  }
}

// MARK: XCTestObservation
extension TestRunner: XCTestObservation {
  public func testCase(_ testCase: XCTestCase,
                       didFailWithDescription description: String,
                       inFile filePath: String?, atLine lineNumber: UInt) {
    print("\(description) in file: \(filePath), line: \(lineNumber)")
  }
}
