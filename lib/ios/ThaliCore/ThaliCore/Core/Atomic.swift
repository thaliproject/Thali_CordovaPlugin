//
//  Atomic.swift
//  ReactiveCocoa
//
//  Created by Justin Spahr-Summers on 2014-07-13.
//  Copyright (c) 2012 - 2016, GitHub, Inc. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy of this software
//  and associated documentation files (the "Software"), to deal in the Software without
//  restriction, including without limitation the rights to use, copy, modify, merge, publish,
//  distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
//  Software is furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in all copies or
//  substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
//  INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE
//  AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
//  DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
//  Thali CordovaPlugin
//  Atomic.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

final class PosixThreadMutex: NSLocking {

  fileprivate var mutex = pthread_mutex_t()

  init() {
    let result = pthread_mutex_init(&mutex, nil)
    precondition(result == 0, "Failed to initialize mutex with error \(result)")
  }

  deinit {
    let result = pthread_mutex_destroy(&mutex)
    precondition(result == 0, "Failed to destroy mutex with error \(result)")
  }

  @objc func lock() {
    let result = pthread_mutex_lock(&mutex)
    precondition(result == 0, "Failed to lock \(self) with error \(result)")
  }

  @objc func unlock() {
    let result = pthread_mutex_unlock(&mutex)
    precondition(result == 0, "Failed to unlock \(self) with error \(result)")
  }
}

public final class Atomic<Value> {
  fileprivate let lock: PosixThreadMutex
  fileprivate var privateValue: Value

  public var value: Value {
    get {
      return withValue { $0 }
    }
  }

  /**
   Initialize the variable with the given initial value

   - parameter value: Initial value for `self`.
   */
  public init(_ value: Value) {
    privateValue = value
    lock = PosixThreadMutex()
  }

  /*!
   Atomically modifies the variable

   - parameter action: A closure that takes the current value

   - throws: rethrows errors

   - returns: The result of the action
   */
  @discardableResult public func modify<Result>(action: (inout Value) throws -> Result) rethrows
                                                -> Result {
    lock.lock()
    defer { lock.unlock() }

    return try action(&privateValue)
  }

  /*!
   Atomically perform an arbitrary action using the current value of the variable

   - parameter action: A closure that takes the current value

   - throws: rethrows errors

   - returns: The result of the action
   */
  public func withValue<Result>(action: (Value) throws -> Result) rethrows -> Result {
    lock.lock()
    defer { lock.unlock() }

    return try action(privateValue)
  }
}
