//
//  Thali CordovaPlugin
//  BrowserTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import MultipeerConnectivity
@testable import ThaliCore
import XCTest

class BrowserTests: XCTestCase {

  // MARK: - State
  var randomlyGeneratedServiceType: String!
  var randomlyGeneratedPeer: Peer!
  var randomlyGeneratedPeerID: MCPeerID!
  var mcBrowser: MCNearbyServiceBrowser!

  let foundPeerTimeout: TimeInterval = 1.0
  let lostPeerTimeout: TimeInterval = 1.0
  let startBrowsingErrorTimeout: TimeInterval = 1.0

  // MARK: - Setup & Teardown
  override func setUp() {
    super.setUp()
    randomlyGeneratedServiceType = String.randomValidServiceType(length: 7)
    randomlyGeneratedPeer = Peer()
    randomlyGeneratedPeerID = MCPeerID(displayName: randomlyGeneratedPeer.stringValue)
    mcBrowser = MCNearbyServiceBrowser(peer: randomlyGeneratedPeerID,
                                       serviceType: randomlyGeneratedServiceType)
  }

  override func tearDown() {
    randomlyGeneratedServiceType = nil
    randomlyGeneratedPeer = nil
    randomlyGeneratedPeerID = nil
    mcBrowser = nil
    super.tearDown()
  }

  // MARK: - Tests
  func testStartChangesListeningState() {
    // Given
    let newBrowser = Browser(serviceType: randomlyGeneratedServiceType,
                             foundPeer: unexpectedFoundPeerHandler,
                             lostPeer: unexpectedLostPeerHandler)

    guard let browser = newBrowser else {
      failBrowserMustNotBeNil()
      return
    }

    // When
    browser.startListening(unexpectedErrorHandler)
    // Then
    XCTAssertTrue(browser.listening)

    // Cleanup
    browser.stopListening()
  }

  func testStopWithoutCallingStartIsNOTError() {
    // Given
    let newBrowser = Browser(serviceType: randomlyGeneratedServiceType,
                             foundPeer: unexpectedFoundPeerHandler,
                             lostPeer: unexpectedLostPeerHandler)

    guard let browser = newBrowser else {
      failBrowserMustNotBeNil()
      return
    }

    // When
    browser.stopListening()
    // Then
    XCTAssertFalse(browser.listening)
  }

  func testStopTwiceWithoutCallingStartIsNOTError() {
    // Given
    let newBrowser = Browser(serviceType: randomlyGeneratedServiceType,
                             foundPeer: unexpectedFoundPeerHandler,
                             lostPeer: unexpectedLostPeerHandler)

    guard let browser = newBrowser else {
      failBrowserMustNotBeNil()
      return
    }

    // When
    browser.stopListening()
    browser.stopListening()

    // Then
    XCTAssertFalse(browser.listening)
  }

  func testStartStopChangesListeningState() {
    // Given
    let newBrowser = Browser(serviceType: randomlyGeneratedServiceType,
                             foundPeer: unexpectedFoundPeerHandler,
                             lostPeer: unexpectedLostPeerHandler)

    guard let browser = newBrowser else {
      failBrowserMustNotBeNil()
      return
    }

    // When
    browser.startListening(unexpectedErrorHandler)
    // Then
    XCTAssertTrue(browser.listening)

    // When
    browser.stopListening()
    // Then
    XCTAssertFalse(browser.listening)
  }

  func testStartStopStartChangesListeningState() {
    // Given
    let newBrowser = Browser(serviceType: randomlyGeneratedServiceType,
                             foundPeer: unexpectedFoundPeerHandler,
                             lostPeer: unexpectedLostPeerHandler)

    guard let browser = newBrowser else {
      failBrowserMustNotBeNil()
      return
    }

    // When
    browser.startListening(unexpectedErrorHandler)
    // Then
    XCTAssertTrue(browser.listening)

    // When
    browser.stopListening()
    // Then
    XCTAssertFalse(browser.listening)

    // When
    browser.startListening(unexpectedErrorHandler)
    // Then
    XCTAssertTrue(browser.listening)
  }

  func testStartListeningCalledTwiceChangesStateProperly() {
    // Given
    let newBrowser = Browser(serviceType: randomlyGeneratedServiceType,
                             foundPeer: unexpectedFoundPeerHandler,
                             lostPeer: unexpectedLostPeerHandler)

    guard let browser = newBrowser else {
      failBrowserMustNotBeNil()
      return
    }

    // When
    browser.startListening(unexpectedErrorHandler)
    browser.startListening(unexpectedErrorHandler)
    // Then
    XCTAssertTrue(browser.listening)
  }

  func testStopListeningCalledTwiceChangesStateProperly() {
    // Given
    let newBrowser = Browser(serviceType: randomlyGeneratedServiceType,
                             foundPeer: unexpectedFoundPeerHandler,
                             lostPeer: unexpectedLostPeerHandler)

    guard let browser = newBrowser else {
      failBrowserMustNotBeNil()
      return
    }

    browser.startListening(unexpectedErrorHandler)
    XCTAssertTrue(browser.listening)

    // When
    browser.stopListening()
    browser.stopListening()
    // Then
    XCTAssertFalse(browser.listening)
  }

  func testFoundPeerHandlerCalled() {
    // Expectations
    let foundPeer = expectation(description: "foundPeerHandler is called on Browser object")

    // Given
    let newBrowser = Browser(serviceType: randomlyGeneratedServiceType,
                             foundPeer: {
                               [weak foundPeer] _ in
                               foundPeer?.fulfill()
                             },
                             lostPeer: unexpectedLostPeerHandler)

    guard let browser = newBrowser else {
      failBrowserMustNotBeNil()
      return
    }

    // When
    // Fake invocation of delegate method
    browser.browser(mcBrowser, foundPeer: randomlyGeneratedPeerID, withDiscoveryInfo: nil)

    // Then
    waitForExpectations(timeout: foundPeerTimeout, handler: nil)
  }

  func testLostPeerHandlerCalled() {
    // Expectations
    let lostPeer = expectation(description: "lostPeerHandler is called on Browser object")
    // Given
    let newBrowser = Browser(serviceType: randomlyGeneratedServiceType,
                             foundPeer: unexpectedFoundPeerHandler,
                             lostPeer: {
                               [weak lostPeer] _ in
                               lostPeer?.fulfill()
                             })

    guard let browser = newBrowser else {
      failBrowserMustNotBeNil()
      return
    }

    // When
    browser.browser(mcBrowser, lostPeer: randomlyGeneratedPeerID)

    // Then
    waitForExpectations(timeout: lostPeerTimeout, handler: nil)
  }

  func testStartListeningErrorHandlerCalled() {
    // Expectations
    let failedStartBrowsing =
      expectation(description: "Failed start advertising " +
        "because of delegate MCNearbyServiceBrowserDelegate call")

    // Given
    let newBrowser = Browser(serviceType: randomlyGeneratedServiceType,
                             foundPeer: unexpectedFoundPeerHandler,
                             lostPeer: unexpectedLostPeerHandler)

    guard let browser = newBrowser else {
      failBrowserMustNotBeNil()
      return
    }

    browser.startListening {
      [weak failedStartBrowsing] error in
      failedStartBrowsing?.fulfill()
    }

    // When
    // Fake invocation of delegate method
    // Send error start browsing failed error
    let error = NSError(domain: "org.thaliproject.test",
                        code: 42,
                        userInfo: nil)
    browser.browser(mcBrowser, didNotStartBrowsingForPeers: error)

    // Then
    waitForExpectations(timeout: startBrowsingErrorTimeout, handler: nil)
  }

  func testInviteToConnectPeerMethodReturnsSession() {
    // Expectations
    let foundPeer = expectation(description: "foundPeerHandler is called on Browser object")

    // Given
    // Firsly we have to "find" peer and get handler called
    let newBrowser = Browser(serviceType: randomlyGeneratedServiceType,
                             foundPeer: {
                              [weak foundPeer] foundedPeer in

                              XCTAssertEqual(foundedPeer, self.randomlyGeneratedPeer)
                              foundPeer?.fulfill()
      },
                             lostPeer: unexpectedLostPeerHandler)

    guard let browser = newBrowser else {
      failBrowserMustNotBeNil()
      return
    }

    // Fake invocation of delegate method
    browser.browser(mcBrowser, foundPeer: randomlyGeneratedPeerID, withDiscoveryInfo: nil)

    waitForExpectations(timeout: foundPeerTimeout, handler: nil)

    // When
    do {
      let session = try
        browser.inviteToConnect(randomlyGeneratedPeer,
                                sessionConnected:  unexpectedConnectHandler,
                                sessionNotConnected: unexpectedDisconnectHandler)
      // Then
      XCTAssertNotNil(session)
    } catch let error {
      XCTFail("inviteToConnect methods didn't return Session. Unexpected error: \(error)")
    }
  }

  func testInviteToConnectWrongPeerReturnsIllegalPeerIDError() {
    // Given
    let newBrowser = Browser(serviceType: randomlyGeneratedServiceType,
                             foundPeer: unexpectedFoundPeerHandler,
                             lostPeer: unexpectedLostPeerHandler)

    guard let browser = newBrowser else {
      failBrowserMustNotBeNil()
      return
    }

    // When
    do {
      let _ = try browser.inviteToConnect(randomlyGeneratedPeer,
                                          sessionConnected: unexpectedConnectHandler,
                                          sessionNotConnected: unexpectedDisconnectHandler)
    } catch let error as ThaliCoreError {
      // Then
      XCTAssertEqual(error, ThaliCoreError.IllegalPeerID)
    } catch let error {
      XCTFail("inviteToConnect didn't return IllegalPeerID error. Unexpected error: \(error)")
    }
  }

  // MARK: - Private methods and handlers of unexpected events
  fileprivate func unexpectedFoundPeerHandler(_ peer: Peer) {
    XCTFail("Unexpected call foundPeerHandler with peer: \(peer)")
  }

  fileprivate func unexpectedLostPeerHandler(_ peer: Peer) {
    XCTFail("unexpected lostPeerHandler with peer: \(peer)")
  }

  fileprivate func failBrowserMustNotBeNil() {
    XCTFail("Browser must not be nil")
  }
}
