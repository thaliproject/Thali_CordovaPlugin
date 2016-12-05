//
//  AppContext+TestRuner.swift
//  Thali
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import Foundation
import SwiftXCTest
import ThaliCore
import ThaliCoreCITests

extension AppContext: TestRunnerProtocol {
  func runNativeTests() -> String {
    let rootTestSuite = XCTestSuite(name: "All tests")

    let currentTestSuite = XCTestSuite(
      name: "All tests",
      testCases: [
        ThaliCoreTests.allTests,
        [testCase(AppContextTests.allTests)]
      ].flatMap { $0 }
    )

    rootTestSuite.addTest(currentTestSuite)

    let runner = TestRunner(testSuite: rootTestSuite)
    runner.runTest()
    return runner.resultDescription ?? ""
  }
}
