//
//  THEAppContext.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <Foundation/Foundation.h>

#import "THEThaliEventDelegate.h"
#import "THEPeerDiscoveryDelegate.h"
#import "THERemoteConnectionDelegate.h"

// Callback that will be called when the lower levels have established
// a client relay in response to a connect
typedef void(^ClientConnectCallback)(NSString *error, NSDictionary *connection);

// THEAppContext interface.
@interface THEAppContext : NSObject <THEPeerDiscoveryDelegate, THERemoteConnectionDelegate>

// Set the event delegate
- (void)setThaliEventDelegate:(id<THEThaliEventDelegate>) eventDelegate;

// Start the client components
- (BOOL)startListeningForAdvertisements;

// Stop the client components
- (BOOL)stopListeningForAdvertisements;

// Start the server components
- (BOOL)startUpdateAdvertisingAndListening:(unsigned short)serverPort;

// Stop the server components
- (BOOL)stopAdvertisingAndListening;

// Connects to the peer with the specified peer identifier.
- (BOOL)connectToPeer:(NSString *)peerIdentifier connectCallback:(ClientConnectCallback)connectCallback;

// Kill connection without cleanup - Testing only !!
- (BOOL)killConnections:(NSString *)peerIdentifier;

- (void)didFindPeer:(NSDictionary *)peer;
- (void)didLosePeer:(NSString *)peerIdentifier;

// Allow external component to force us to fire event
- (void)fireNetworkChangedEvent;


//
// A set of functions which make testing a lot easier
//
#ifdef DEBUG

//
- (void)setPeerIdentifier:(NSString *)peerIdentifier;

#endif

@end
