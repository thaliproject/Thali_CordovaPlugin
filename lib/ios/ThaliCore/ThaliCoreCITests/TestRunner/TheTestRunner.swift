//
//  TheTestRunner.swift
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
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
