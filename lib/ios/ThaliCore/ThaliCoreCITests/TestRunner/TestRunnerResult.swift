//
//  TestRunnerResult.swift
//  ThaliCore
//
//  Created by Ilya Laryionau on 30/08/16.
//  Copyright © 2016 Thali. All rights reserved.
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
