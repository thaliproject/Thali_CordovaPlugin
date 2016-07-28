//
//  THEMultipeerClientSocketRelayDelegate.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

// Protocol implemented by classes wishing to know about socket related events
@protocol THEMultipeerClientSocketRelayDelegate <NSObject>

// Called when the client relay succesfully established it's listening port
- (void)didListenWithLocalPort:(uint)port;

// Called when the client relay fails to listen
- (void)didNotListenWithErrorMessage:(NSString *)errorMsg;

// Called when the client is closed
- (void)didDisconnectFromPeer;

@end
