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

    private let testSuite: XCTestSuite

    private init(testSuite: XCTestSuite) {
        self.testSuite = testSuite
    }

    static let `default`: TestRunner = TestRunner.createDefaultRunner()

    private static func createDefaultRunner() -> TestRunner {
        return TestRunner(testSuite: XCTestSuite.defaultTestSuite())
    }

    var runResult: TestRunnerResult {
        return testSuite.runResult
    }

    func runTest() {
        // Tests must only be run on the main thread.
        //
        // Please note that it's important not using GCD here.
        // XCTest.framework uses NSRunLoop for async testing
        // so async testing won't work as expected
        // in case of running tests in CGD main queue

        testSuite.performSelectorOnMainThread(#selector(runTest), withObject: nil, waitUntilDone: true)
    }
}
