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

// MARK: - Current version of TestRunner doesn't display in logs assertion failures.
// This category `overrides` recordFailureWithDescription and adds logging for failures.
extension XCTestCase {
    @objc func swizzled_recordFailureWithDescription(description: String,
                                                     inFile filePath: String,
                                                     atLine lineNumber: UInt,
                                                     expected: Bool) {
        // We don't have endless recursion here because of method swizzling in TestRunner.
        // Therefore original implementation of `recordFailureWithDescription` is calling here
        self.swizzled_recordFailureWithDescription(description,
                                                   inFile: filePath,
                                                   atLine: lineNumber,
                                                   expected: expected)
        print("\(description) in file: \(filePath), line: \(lineNumber)")
    }
}

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

    override public class func initialize() {
        super.initialize()

        struct Static {
            static var token: dispatch_once_t = 0
        }

        dispatch_once(&Static.token) {
            swizzleRecordFailure()
        }
    }

    private class func swizzleRecordFailure() {
        let originalSelector = #selector(XCTestCase.recordFailureWithDescription(_:inFile:atLine:expected:))
        let swizzledSelector = #selector(XCTestCase.swizzled_recordFailureWithDescription(_:inFile:atLine:expected:))

        let originalMethod = class_getInstanceMethod(XCTestCase.self, originalSelector)
        let swizzledMethod = class_getInstanceMethod(XCTestCase.self, swizzledSelector)

        method_exchangeImplementations(originalMethod, swizzledMethod)
    }

    public func runTest() {
        // Test must only be run on the main thread.
        // Please note that it's important not using GCD, because XCTest.framework doesn't use GCD
        testSuite.performSelectorOnMainThread(#selector(runTest), withObject: nil,
                                              waitUntilDone: true)
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
