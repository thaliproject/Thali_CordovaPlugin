//
//  THEMultipeerServer.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <MultipeerConnectivity/MultipeerConnectivity.h>

#import "THEMultipeerPeerSession.h"
#import "THEMultipeerDiscoveryDelegate.h"
#import "THEMultipeerSessionStateDelegate.h"
#import "THEMultipeerServerConnectionDelegate.h"

// Encapsulate the local server, handles advertising the serviceType and accepting
// connections from remote clients
@interface THEMultipeerServer : NSObject <MCNearbyServiceAdvertiserDelegate>

- (instancetype)initWithPeerID:(MCPeerID *)peerID
                     withPeerIdentifier:(NSString *)peerIdentifier
                        withServiceType:(NSString *)serviceType
                         withServerPort:(unsigned short)serverPort
         withMultipeerDiscoveryDelegate:(id<THEMultipeerDiscoveryDelegate>)multipeerDiscoveryDelegate
               withSessionStateDelegate:(id<THEMultipeerSessionStateDelegate>)sessionStateDelegate
  withMultipeerServerConnectionDelegate:(id<THEMultipeerServerConnectionDelegate>)serverConnectionDelegate;


// Start/stop advertising
- (void)start;
- (void)stop;

// Restart advertising without killing existing sessions
- (void)restart;

// Set reset callback for managing restarts
- (void)setTimerResetCallback:(void (^)(void))timerCallback;

- (const THEMultipeerServerSession *)sessionForUUID:(NSString *)peerUUID;

@end
