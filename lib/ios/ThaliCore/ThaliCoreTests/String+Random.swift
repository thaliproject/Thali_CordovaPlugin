//
//  Thali CordovaPlugin
//  String+Random.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license
//  information.
//

import Foundation

// MARK: - Random string generator
extension String {

    static func random(length length: Int) -> String {
        let letters: String = "abcdefghkmnopqrstuvxyzABCDEFGHKLMNOPQRSTUXYZ"
        var randomString = ""

        let lettersLength = UInt32(letters.characters.count)
        for _ in 0..<length {
            let rand = Int(arc4random_uniform(lettersLength))
            let char = letters[letters.startIndex.advancedBy(rand)]
            randomString.append(char)
        }
        return randomString
    }
}
