//
//  Thali CordovaPlugin
//  THERemoteConnectionDelegate.h
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

// Informs interested parties about the accepting or otherwise
// of connections from remote peers
@protocol THERemoteConnectionDelegate

// @optional
// Fired when a new connection is accepted that was *not* initiated by the local peer
//- (void)didAcceptConnectionWithClientPort:(unsigned short)clientPort withServerPort:(unsigned short)serverPort;

// Fired when we fail to connect to the local app server port
- (void)didNotAcceptConnectionWithServerPort:(unsigned short)serverPort;

@end
