//
//  Thali CordovaPlugin
//  Atomic.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation

final class PosixThreadMutex: NSLocking {
    private var mutex = pthread_mutex_t()

    init() {
        let result = pthread_mutex_init(&mutex, nil)
        precondition(result == 0, "Failed to initialize mutex with error \(result).")
    }

    deinit {
        let result = pthread_mutex_destroy(&mutex)
        precondition(result == 0, "Failed to destroy mutex with error \(result).")
    }

    @objc func lock() {
        let result = pthread_mutex_lock(&mutex)
        precondition(result == 0, "Failed to lock \(self) with error \(result).")
    }

    @objc func unlock() {
        let result = pthread_mutex_unlock(&mutex)
        precondition(result == 0, "Failed to unlock \(self) with error \(result).")
    }
}

public final class Atomic<Value> {
	private let lock: PosixThreadMutex
	private var _value: Value

    public var value: Value {
        get {
            return withValue { $0 }
        }
    }

	/// Initialize the variable with the given initial value.
	///
	/// - parameters:
	///   - value: Initial value for `self`.
	public init(_ value: Value) {
		_value = value
		lock = PosixThreadMutex()
	}

	/// Atomically modifies the variable.
	///
	/// - parameters:
	///   - action: A closure that takes the current value.
	///
	/// - returns: The result of the action.
	public func modify<Result>(action: (inout Value) throws -> Result) rethrows -> Result {
		lock.lock()
		defer { lock.unlock() }

		return try action(&_value)
	}

	/// Atomically perform an arbitrary action using the current value of the
	/// variable.
	///
	/// - parameters:
	///   - action: A closure that takes the current value.
	///
	/// - returns: The result of the action.
	public func withValue<Result>(action: (Value) throws -> Result) rethrows -> Result {
		lock.lock()
		defer { lock.unlock() }

		return try action(_value)
	}
}
