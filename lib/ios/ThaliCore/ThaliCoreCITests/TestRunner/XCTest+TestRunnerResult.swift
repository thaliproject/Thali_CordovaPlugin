//
//  XCTest+TestRunnerResult.swift
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation
import XCTest

extension XCTest {
    var runResult: TestRunnerResult {
        switch self {
        case let testSuite as XCTestSuite:
            let initialResult = TestRunnerResult(
                totalCount: 0,
                executionCount: 0,
                failureCount: 0,
                unexpectedExceptionCount: 0,
                succeededCount: 0,
                totalDuration: 0,
                executed: true
            )

            return testSuite.tests
                .reduce(initialResult) { $0 + $1.runResult }
        default:
            // this case should be when test wasn't executed
            guard let testRun = testRun else {
                return TestRunnerResult(
                    totalCount: 1,
                    executionCount: 0,
                    failureCount: 0,
                    unexpectedExceptionCount: 0,
                    succeededCount: 0,
                    totalDuration: 0,
                    executed: false
                )
            }

            return TestRunnerResult(
                totalCount: 1,
                executionCount: testRun.executionCount,
                failureCount: testRun.failureCount,
                unexpectedExceptionCount: testRun.totalFailureCount,
                succeededCount: testRun.hasSucceeded ? 1 : 0,
                totalDuration: testRun.totalDuration,
                executed: true
            )
        }
    }
}
