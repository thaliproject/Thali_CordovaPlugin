//
//  Thali CordovaPlugin
//  StringRandomTests.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import XCTest

class StringRandomTests: XCTestCase {

  // MARK: - State
  let serviceTypeLength = 10

  // MARK: - Tests
  func testReturnsTrueWhenServiceTypeIsValid() {
    for _ in 0...1000 {
      // Given
      let randomServiceType = String.randomValidServiceType(length: serviceTypeLength)

      // When, Then
      XCTAssertTrue(String.isValidServiceType(randomServiceType))
    }
  }

  func testReturnsTrueWhenServiceTypeIsThaliproject() {
    // Given
    let thaliProjectServiceType = "thaliproject"

    // When, Then
    XCTAssertTrue(String.isValidServiceType(thaliProjectServiceType))
  }

  func testReturnsFalseWhenServiceTypeIsEmpty() {
    // Given
    let invalidServiceType = String.random(length: 0)

    // When, Then
    XCTAssertFalse(String.isValidServiceType(invalidServiceType))
  }

  func testReturnsFalseWhenServiceTypeCharMoreThanMax() {
    // Given
    let invalidServiceType = String.randomValidServiceType(length: 16)

    // When, Then
    XCTAssertFalse(String.isValidServiceType(invalidServiceType))
  }

  func testReturnsFalseWhenServiceTypeContainsNotPermittedCharacter() {
    // Given
    let randomIndexInString = Int(arc4random_uniform(UInt32(serviceTypeLength)))
    let firstPartLength = randomIndexInString
    let secondPartLength = serviceTypeLength - randomIndexInString
    let firstRandomlyGeneratedPart = String.randomValidServiceType(length: firstPartLength)
    let secondRandomlyGeneratedPart = String.randomValidServiceType(length: secondPartLength)
    let invalidServiceType = firstRandomlyGeneratedPart + "." + secondRandomlyGeneratedPart

    // When, Then
    XCTAssertFalse(String.isValidServiceType(invalidServiceType))
  }

  func testReturnsFalseWhenServiceTypeDoesNotContainAsLeastOneASCIICharacter() {
    // Given
    let digits = "0123456789"
    let hyphen = "-"
    let invalidAlphabet = digits + hyphen

    let invalidServiceType = String.randomString(with: serviceTypeLength,
                                                 fromAlphabet: invalidAlphabet)

    // When, Then
    XCTAssertFalse(String.isValidServiceType(invalidServiceType))
  }

  func testReturnsFalseWhenServiceTypeContainsHyphenFirst() {
    // Given
    let randomlyGeneratedServiceType = String.randomValidServiceType(length: serviceTypeLength)
    let invalidServiceType = "-" + randomlyGeneratedServiceType

    // When, Then
    XCTAssertFalse(String.isValidServiceType(invalidServiceType))
  }

  func testReturnsFalseWhenServiceTypeContainsHyphenLast() {
    // Given
    let randomlyGeneratedServiceType = String.randomValidServiceType(length: serviceTypeLength)
    let invalidServiceType = randomlyGeneratedServiceType + "-"

    // When, Then
    XCTAssertFalse(String.isValidServiceType(invalidServiceType))
  }

  func testReturnsFalseWhenServiceTypeContainsAdjancesHyphens() {
    // Given
    let randomIndexInString = Int(arc4random_uniform(UInt32(serviceTypeLength)))
    let firstPartLength = randomIndexInString
    let secondPartLength = serviceTypeLength - randomIndexInString
    let firstRandomlyGeneratedPart = String.randomValidServiceType(length: firstPartLength)
    let secondRandomlyGeneratedPart = String.randomValidServiceType(length: secondPartLength)
    let invalidServiceType = firstRandomlyGeneratedPart + "--" + secondRandomlyGeneratedPart

    // When, Then
    XCTAssertFalse(String.isValidServiceType(invalidServiceType))
  }
}
