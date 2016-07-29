//
//  TestRunner.swift
//  ThaliCore
//
//  Created by Ilya Laryionau on 7/28/16.
//  Copyright © 2016 Thali. All rights reserved.
//

import Foundation
import XCTest

@objc
final class TestRunner: NSObject {
    struct RunResult {
        let executedCount: Int
        let succeededCount: Int
        let failureCount: Int
        let duration: NSTimeInterval
    }

    private let testSuite: XCTestSuite
    private let testObservationCenter: XCTestObservationCenter

    private var runningTestSuite: XCTestSuite?
    private var runningTestCase: XCTestCase?
    private var runningTestCaseFailures: [TestRun.Failure] = []

    private(set) var testRuns: [TestRun] = []

    private init(testSuite: XCTestSuite, testObservationCenter: XCTestObservationCenter) {
        self.testSuite = testSuite
        self.testObservationCenter = testObservationCenter
    }

    static let `default`: TestRunner = TestRunner.createDefaultRunner()

    private static func createDefaultRunner() -> TestRunner {
        return TestRunner(testSuite: XCTestSuite.defaultTestSuite(),
                          testObservationCenter: XCTestObservationCenter.sharedTestObservationCenter())
    }

    var runResult: RunResult {
        let executedCount = self.testRuns.count
        var succeededCount = 0
        var failureCount = 0
        let duration = self.testSuite.testRun?.totalDuration ?? 0

        for run in testRuns {

            if run.failures.count != 0 {
                failureCount += 1
            } else {
                succeededCount += 1
            }
        }

        return TestRunner.RunResult(
            executedCount: executedCount,
            succeededCount: succeededCount,
            failureCount: failureCount,
            duration: duration
        )
    }

    func runTest() {
        testSuite.runTest()
    }
}

// MARK: XCTestObservation

extension TestRunner: XCTestObservation {
    func testBundleWillStart(testBundle: NSBundle) {
    }

    func testBundleDidFinish(testBundle: NSBundle) {
    }

    func testSuiteWillStart(testSuite: XCTestSuite) {
        runningTestSuite = testSuite
        testRuns = []
    }

    func testSuite(testSuite: XCTestSuite, didFailWithDescription description: String, inFile filePath: String?,
                   atLine lineNumber: UInt) {
    }

    func testSuiteDidFinish(testSuite: XCTestSuite) {
        runningTestSuite = nil
    }

    func testCaseWillStart(testCase: XCTestCase) {
        runningTestCase = testCase
        runningTestCaseFailures = []
    }

    func testCase(testCase: XCTestCase, didFailWithDescription description: String, inFile filePath: String?,
                  atLine lineNumber: UInt) {
        runningTestCaseFailures.append(
            TestRun.Failure(failureDescription: description, filePath: filePath, line: lineNumber)
        )
    }

    func testCaseDidFinish(testCase: XCTestCase) {
        if let
            runningTestSuite = self.runningTestSuite,
            runningTestCase = self.runningTestCase {

            let runName = "\(runningTestSuite.name)/\(runningTestCase.name)"

            testRuns.append(
                TestRun(name: runName, failures: runningTestCaseFailures)
            )
        } else {
            assertionFailure()
        }

        runningTestCase = testCase
        runningTestCaseFailures = []
    }
}

// MARK:

extension TestRunner.RunResult {
    var jsonString: String? {
        let jsonDictionary = [
            "total": executedCount,
            "passed": succeededCount,
            "failed": self.failureCount,
            "ignored": 0,
            "duration": self.duration,
            "executed": true
        ]

        do {
            let jsonData = try NSJSONSerialization.dataWithJSONObject(jsonDictionary, options: [])

            return String(data: jsonData, encoding: NSUTF8StringEncoding)
        } catch _ as NSError {
            return nil
        }
    }
}
