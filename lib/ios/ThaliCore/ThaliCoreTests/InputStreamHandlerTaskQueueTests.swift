//
//  InputStreamHandlerTaskQueueTests.swift
//  ThaliCore
//
//  Created by Alexander Evsyuchenya on 9/5/16.
//  Copyright © 2016 Thali. All rights reserved.
//

import XCTest
import Foundation
@testable import ThaliCore

class InputStreamHandlerTaskQueueTests: XCTestCase {
    var expectation: XCTestExpectation!
    var queue: InputStreamHandlerTaskQueue!

    override func setUp() {
        expectation = expectationWithDescription("receiverd inputStream")
        queue = InputStreamHandlerTaskQueue()
    }

    func testAddStreamFirst() {
        let streamName = "streamFirst"
        var receivedStreamName: String?
        let stream = NSInputStream(data: NSData(bytes: nil, length: 0))
        queue.add(stream, withName: streamName)
        dispatch_sync(queue.serialQueue) {
            XCTAssertEqual(self.queue.streamPool.count, 1)
        }
        queue.add { [weak expectation] in
            receivedStreamName = $0.1
            expectation?.fulfill()
        }
        waitForExpectationsWithTimeout(1.0, handler: nil)
        XCTAssertEqual(queue.streamHandlerPool.count, 0)
        XCTAssertEqual(queue.streamPool.count, 0)
        XCTAssertEqual(receivedStreamName, streamName)
    }

    func testAddHandlerFirst() {
        let streamName = "handlerFirst"
        var receivedStreamName: String?
        let stream = NSInputStream(data: NSData(bytes: nil, length: 0))
        queue.add { [weak expectation] in
            receivedStreamName = $0.1
            expectation?.fulfill()
        }
        dispatch_sync(queue.serialQueue) {
            XCTAssertEqual(self.queue.streamHandlerPool.count, 1)
        }
        queue.add(stream, withName: streamName)
        waitForExpectationsWithTimeout(1.0, handler: nil)
        XCTAssertEqual(queue.streamHandlerPool.count, 0)
        XCTAssertEqual(queue.streamPool.count, 0)
        XCTAssertEqual(receivedStreamName, streamName)
    }

}
