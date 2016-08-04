//
//  Thali CordovaPlugin
//  StreamService.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

import Foundation

/// define interface for service who can manage connection between different peers
public protocol StreamService: class {
    init(serviceName: String, sessionManager: SessionManager)
    
    /**
     Start service
     */
    func start()
    
    /**
     Stop service
     */
    func stop()
}
