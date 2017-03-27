//
//  Thali CordovaPlugin
//  AdvertiserManagerTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

@testable import ThaliCore
import XCTest

class AdvertiserManagerTests: XCTestCase {

  // MARK: - State
  var serviceType: String!
  var advertiserManager: AdvertiserManager!
  let disposeTimeout: TimeInterval = 4.0

  // MARK: - Setup & Teardown
  override func setUp() {
    super.setUp()
    serviceType = String.randomValidServiceType(length: 7)
    advertiserManager = AdvertiserManager(serviceType: serviceType,
                                          disposeAdvertiserTimeout: disposeTimeout)
  }

  override func tearDown() {
    serviceType = nil
    advertiserManager.stopAdvertising()
    advertiserManager = nil
    super.tearDown()
  }

  // MARK: - Tests
  func testStartAdvertisingChangesState() {
    // Given
    XCTAssertFalse(advertiserManager.advertising)

    // When
    advertiserManager.startUpdateAdvertisingAndListening(onPort: 42,
                                                         errorHandler: unexpectedErrorHandler)

    // Then
    XCTAssertTrue(advertiserManager.advertising)
  }

  func testStopAdvertisingWithoutCallingStartIsNOTError() {
    // Given
    XCTAssertFalse(advertiserManager.advertising)

    // When
    advertiserManager.stopAdvertising()

    // Then
    XCTAssertFalse(advertiserManager.advertising)
  }

  func testStopAdvertisingTwiceWithoutCallingStartIsNOTError() {
    // Given
    XCTAssertFalse(advertiserManager.advertising)

    // When
    advertiserManager.stopAdvertising()
    advertiserManager.stopAdvertising()

    // Then
    XCTAssertFalse(advertiserManager.advertising)
  }

  func testStartAdvertisingTwice() {
    // Given
    XCTAssertFalse(advertiserManager.advertising)

    // When
    advertiserManager.startUpdateAdvertisingAndListening(onPort: 42,
                                                         errorHandler: unexpectedErrorHandler)
    advertiserManager.startUpdateAdvertisingAndListening(onPort: 43,
                                                         errorHandler: unexpectedErrorHandler)

    // Then
    XCTAssertTrue(advertiserManager.advertising)
  }

  func testStartStopAdvertisingChangesInternalNumberOfAdvertisers() {
    // Given
    let expectedNumberOfAdvertisersBeforeStartMethod = 0
    let expectedNumberOfAdvertisersAfterStartMethod = 1
    let expectedNumberOfAdvertisersAfterStopMethod = 0

    XCTAssertEqual(advertiserManager.advertisers.value.count,
                   expectedNumberOfAdvertisersBeforeStartMethod)

    // When
    advertiserManager.startUpdateAdvertisingAndListening(onPort: 42,
                                                         errorHandler: unexpectedErrorHandler)

    // Then
    XCTAssertTrue(advertiserManager.advertising, "advertising is not active")
    XCTAssertEqual(advertiserManager.advertisers.value.count,
                   expectedNumberOfAdvertisersAfterStartMethod)

    // When
    advertiserManager.stopAdvertising()

    // Then
    XCTAssertFalse(advertiserManager.advertising, "advertising is still active")
    XCTAssertEqual(advertiserManager.advertisers.value.count,
                   expectedNumberOfAdvertisersAfterStopMethod)
  }

  func testStartAdvertisingTwiceChangesInternalNumberOfAdvertisers() {
    // Given
    let expectedNumberOfAdvertisersBeforeStartMethod = 0
    let expectedNumberOfAdvertisersAfterFirstStartMethod = 1
    let expectedNumberOfAdvertisersAfterSecondStartMethod = 2

    XCTAssertEqual(advertiserManager.advertisers.value.count,
                   expectedNumberOfAdvertisersBeforeStartMethod)

    // When
    advertiserManager.startUpdateAdvertisingAndListening(onPort: 42,
                                                         errorHandler: unexpectedErrorHandler)

    // Then
    XCTAssertTrue(advertiserManager.advertising, "advertising is not active")
    XCTAssertEqual(advertiserManager.advertisers.value.count,
                   expectedNumberOfAdvertisersAfterFirstStartMethod)

    // When
    advertiserManager.startUpdateAdvertisingAndListening(onPort: 43,
                                                         errorHandler: unexpectedErrorHandler)

    // Then
    XCTAssertTrue(advertiserManager.advertising, "advertising is not active")
    XCTAssertEqual(advertiserManager.advertisers.value.count,
                   expectedNumberOfAdvertisersAfterSecondStartMethod)
  }

  func testStartStopStartAdvertisingChangesInternalNumberOfAdvertisers() {
    // Given
    let expectedNumberOfAdvertisersBeforeStartMethod = 0
    let expectedNumberOfAdvertisersAfterStartMethod = 1
    let expectedNumberOfAdvertisersAfterStopMethod = 0

    XCTAssertEqual(advertiserManager.advertisers.value.count,
                   expectedNumberOfAdvertisersBeforeStartMethod)

    // When
    advertiserManager.startUpdateAdvertisingAndListening(onPort: 42,
                                                         errorHandler: unexpectedErrorHandler)

    // Then
    XCTAssertTrue(advertiserManager.advertising, "advertising is not active")
    XCTAssertEqual(advertiserManager.advertisers.value.count,
                   expectedNumberOfAdvertisersAfterStartMethod)

    // When
    advertiserManager.stopAdvertising()

    // Then
    XCTAssertFalse(advertiserManager.advertising, "advertising is still active")
    XCTAssertEqual(advertiserManager.advertisers.value.count,
                   expectedNumberOfAdvertisersAfterStopMethod)

    // When
    advertiserManager.startUpdateAdvertisingAndListening(onPort: 42,
                                                         errorHandler: unexpectedErrorHandler)

    // Then
    XCTAssertTrue(advertiserManager.advertising, "advertising is not active")
    XCTAssertEqual(advertiserManager.advertisers.value.count,
                   expectedNumberOfAdvertisersAfterStartMethod)
  }

  func testAdvertiserDisposedAfterTimeoutWhenSecondAdvertiserStarts() {
    // Given
    let port1: UInt16 = 42
    let port2: UInt16 = 43

    advertiserManager.startUpdateAdvertisingAndListening(onPort: port1,
                                                         errorHandler: unexpectedErrorHandler)
    XCTAssertEqual(advertiserManager.advertisers.value.count, 1)

    let firstAdvertiserPeer = advertiserManager.advertisers.value.first!.peer
    let firstAdvertiserDisposed = expectation(description: "Advertiser disposed after delay")

    // When
    advertiserManager.startUpdateAdvertisingAndListening(onPort: port2,
                                                         errorHandler: unexpectedErrorHandler)
    XCTAssertEqual(advertiserManager.advertisers.value.count, 2)

    advertiserManager.didDisposeOfAdvertiserForPeerHandler = {
      [weak firstAdvertiserDisposed] peer in

      XCTAssertEqual(firstAdvertiserPeer, peer)
      firstAdvertiserDisposed?.fulfill()
    }

    // Then
    waitForExpectations(timeout: disposeTimeout, handler: nil)
    XCTAssertEqual(advertiserManager.advertisers.value.count, 1)
  }

  func testStopAdvertising() {
    advertiserManager.startUpdateAdvertisingAndListening(onPort: 42,
                                                         errorHandler: unexpectedErrorHandler)
    XCTAssertEqual(advertiserManager.advertisers.value.count, 1)
    XCTAssertTrue(advertiserManager.advertising)
    advertiserManager.stopAdvertising()
    XCTAssertEqual(advertiserManager.advertisers.value.count, 0)
    XCTAssertFalse(advertiserManager.advertising)
  }
}
