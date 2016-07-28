//
//  THEMultipeerServerConnectionDelegate.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

// Defines the interface through which the multipeer session will 
// inform it's delegate connections from remote peers
@protocol THEMultipeerServerConnectionDelegate <NSObject>

// Notifies delegate a connection was made or, if clientPort == 0, failed
- (void)didCompleteReverseConnection:(NSString *)peerIdentifier
                      withClientPort:(unsigned short)clientPort
                      withServerPort:(unsigned short)serverPort;


@end

