//
//  Thali CordovaPlugin
//  String+Random.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation

extension String {
    static func randomStringWithLength(len: Int) -> String {
        let letters: String = "abcdefghkmnopqrstuvxyzABCDEFGHKLMNOPQRSTUXYZ"
        var randomString = ""

        let length = UInt32(letters.characters.count)
        for _ in 0..<len {
            let rand = Int(arc4random_uniform(length))
            let char = letters[letters.startIndex.advancedBy(rand)]
            randomString.append(char)
        }
        return randomString
    }
}
