//
//  THEMultipeerServerSocketRelayDelegate.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

// Protocol implemented by classes wishing to know about socket related events
@protocol THEMultipeerServerSocketRelayDelegate <NSObject>

// Called when the server socket succesfully connects to the app's listening socket
- (void)didConnectWithClientPort:(unsigned short)clientPort withServerPort:(unsigned short)serverPort;

// Called when the server socket fails to connect
- (void)didNotConnectWithServerPort:(unsigned short)serverPort;

@end
