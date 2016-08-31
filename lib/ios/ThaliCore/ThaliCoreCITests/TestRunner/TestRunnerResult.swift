//
//  TestRunnerResult.swift
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation

struct TestRunnerResult {
    let totalCount: UInt
    let executionCount: UInt
    let failureCount: UInt
    let unexpectedExceptionCount: UInt

    let succeededCount: UInt
    let totalDuration: NSTimeInterval

    let executed: Bool
}

func + (left: TestRunnerResult, right: TestRunnerResult) -> TestRunnerResult {
    return TestRunnerResult(
        totalCount: left.totalCount + right.totalCount,
        executionCount: left.executionCount + right.executionCount,
        failureCount:  left.failureCount + right.failureCount,
        unexpectedExceptionCount: left.unexpectedExceptionCount + right.unexpectedExceptionCount,
        succeededCount: left.succeededCount + right.succeededCount,
        totalDuration: left.totalDuration + right.totalDuration,
        executed: left.executed || right.executed
    )
}

// MARK: JSON

extension TestRunnerResult {
    var jsonString: String? {
        let jsonDictionary = [
            "total": totalCount,
            "passed": succeededCount,
            "failed": executionCount - succeededCount,
            "ignored": totalCount - executionCount,
            "duration": totalDuration,
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
