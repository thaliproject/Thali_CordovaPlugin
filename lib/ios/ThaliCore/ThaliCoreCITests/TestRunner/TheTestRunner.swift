//
//  TheTestRunner.swift
//  ThaliCore
//
//  Created by Ilya Laryionau on 7/29/16.
//  Copyright © 2016 Thali. All rights reserved.
//

import Foundation

// Wrapper for compatibility with ObjC code
@objc
public final class THETestRunner: NSObject {
    private let defaultTestRunner: TestRunner = TestRunner.`default`

    public static let defaultRunner: THETestRunner = THETestRunner()

    public func runTest() {
        defaultTestRunner.runTest()
    }

    public var result: String? {
        return defaultTestRunner.runResult.jsonString
    }
}
