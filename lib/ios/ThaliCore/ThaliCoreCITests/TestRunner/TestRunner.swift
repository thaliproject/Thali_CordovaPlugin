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
public final class TestRunner: NSObject {
    struct RunResult {
        let executedCount: Int
        let succeededCount: Int
        let failureCount: Int
        let duration: NSTimeInterval
        let executed: Bool
    }

    private let testSuite: XCTestSuite
    
    private init(testSuite: XCTestSuite) {
        self.testSuite = testSuite
    }

    public static let `default`: TestRunner = TestRunner.createDefaultRunner()

    private static func createDefaultRunner() -> TestRunner {
        return TestRunner(testSuite: XCTestSuite.defaultTestSuite())
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

    public func runTest() {
        // Test must only be run on the main thread.
        dispatch_sync(dispatch_get_main_queue()) {
            self.testSuite.runTest()
        }
    }
}

// MARK:

extension TestRunner.RunResult {
    var jsonString: String? {
        let jsonDictionary = [
            "total": executedCount,
            "passed": succeededCount,
            "failed": failureCount,
            "ignored": 0,
            "duration": duration,
            "executed": executed
        ]

        do {
            let jsonData = try NSJSONSerialization.dataWithJSONObject(jsonDictionary, options: [])

            return String(data: jsonData, encoding: NSUTF8StringEncoding)
        } catch _ as NSError {
            return nil
        }
    }
}
