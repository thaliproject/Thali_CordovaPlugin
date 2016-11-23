//
//  Thali CordovaPlugin
//  String+Random.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import Foundation

// MARK: - Random string generation
extension String {

  /**
   Creates random string that contains only ASCII characters ('a' - 'z', 'A' - 'Z').

   - parameters:
     - length:
       Length of string that will be generated

   - returns:
     Randomly generated string.
   */
  static func random(length: Int) -> String {
    let letters: String = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUWXYZ"
    var randomString = ""

    let lettersLength = UInt32(letters.characters.count)
    for _ in 0..<length {
      let rand = Int(arc4random_uniform(lettersLength))
      let char = letters[letters.characters.index(letters.startIndex, offsetBy: rand)]
      randomString.append(char)
    }
    return randomString
  }

  /**
   Creates random string with characters from given alphabet.

   - parameters:
     - length:
       Length of string that will be generated
     - validAlphabet:
       String that contains allowed characters

   - returns:
     Randomly generated string.
   */
  static func randomString(with length: Int, fromAlphabet validAlphabet: String) -> String {
    var randomString = ""

    let alphabetLength = UInt32(validAlphabet.characters.count)
    for _ in 0..<length {
      let rand = Int(arc4random_uniform(alphabetLength))
      let char = validAlphabet[validAlphabet.characters.index(validAlphabet.startIndex,
                                                              offsetBy: rand)]
      randomString.append(char)
    }
    return randomString
  }
}

// MARK: - Manipulating service type in Bonjour format
extension String {

  static func randomValidServiceType(length: Int) -> String {
    let asciiLetters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUWXYZ"
    let digits = "0123456789"
    let hyphen = "-"
    let validAlphabet = asciiLetters + digits + hyphen
    var randomString = ""

    var previousCharacterWasHyphen = false

    let alphabetLength = UInt32(validAlphabet.characters.count)
    for i in 0..<length {
      let isFirstCharachter = (i == 0)
      let isLastCharachter = (i == length - 1)

      var rand = Int(arc4random_uniform(alphabetLength))
      var char = validAlphabet[validAlphabet.characters.index(validAlphabet.startIndex,
                                                              offsetBy: rand)]

      if isFirstCharachter {
        let allowedAlphabet = asciiLetters + digits
        let allowedAlphabetLength = UInt32(allowedAlphabet.characters.count)
        rand = Int(arc4random_uniform(allowedAlphabetLength))
        char = allowedAlphabet[allowedAlphabet.characters.index(allowedAlphabet.startIndex,
                                                                offsetBy: rand)]
      } else if isLastCharachter {
        let allowedAlphabet = asciiLetters
        let allowedAlphabetLength = UInt32(allowedAlphabet.characters.count)
        rand = Int(arc4random_uniform(allowedAlphabetLength))
        char = allowedAlphabet[allowedAlphabet.characters.index(allowedAlphabet.startIndex,
                                                                offsetBy: rand)]
      } else {
        if previousCharacterWasHyphen {
          while char == Character(hyphen) {
            rand = Int(arc4random_uniform(alphabetLength))
            char = validAlphabet[validAlphabet.characters.index(validAlphabet.startIndex,
                                                                offsetBy: rand)]
          }
          previousCharacterWasHyphen = false
        } else if char == Character(hyphen) {
          previousCharacterWasHyphen = true
        }
      }

      randomString.append(char)
    }
    return randomString
  }

  /**
   Checking if string is in a valid Bonjour format.
   See [RFC6335](https://tools.ietf.org/html/rfc6335#section-5.1) for more details.

   - parameters:
     - string
       String that will be checked

   - returns:
     Bool parameter. `true` if given string is valid serviceType, otherwise `false`.
   */
  static func isValidServiceType(_ string: String) -> Bool {
    let minChars = 0
    let maxChars = 15
    guard string.characters.count >= minChars && string.characters.count <= maxChars else {
      return false
    }

    let asciiLetters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUWXYZ"
    let digits = "0123456789"
    let hyphen = "-"
    let validAlphabet = asciiLetters + digits + hyphen
    let invalidCharacterSet = CharacterSet(charactersIn: validAlphabet).inverted

    guard string.rangeOfCharacter(from: invalidCharacterSet) == nil else {
      return false
    }

    let asciiLettersCharacterSet = CharacterSet(charactersIn: asciiLetters)
    guard string.rangeOfCharacter(from: asciiLettersCharacterSet) != nil else {
      return false
    }

    guard string.characters.first != Character(hyphen) &&
          string.characters.last != Character(hyphen) else {
          return false
    }

    let adjacentHyphens = hyphen + hyphen
    guard string.range(of: adjacentHyphens) == nil else {
      return false
    }

    return true
  }
}
