//
//  THEThaliEventDelegate.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

// Defines an interface through which the peer discovery library can signal
// it's enclosing application

// THEThaliEventDelegate protocol.
@protocol THEThaliEventDelegate <NSObject>

- (void)peerAvailabilityChanged:(NSArray<NSDictionary *>*)peers;
- (void)networkChanged:(NSDictionary *)networkStatus;
- (void)discoveryAdvertisingStateUpdate:(NSDictionary *)discoveryAdvertisingState;
- (void)incomingConnectionToPortNumberFailed:(unsigned short)serverPort;

- (void)appEnteringBackground;
- (void)appEnteredForeground;

@end
