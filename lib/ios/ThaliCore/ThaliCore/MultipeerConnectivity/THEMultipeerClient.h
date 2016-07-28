//
//  THEMultipeerClient.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <MultipeerConnectivity/MultipeerConnectivity.h>

#import "THEAppContext.h"
#import "THEMultipeerDiscoveryDelegate.h"
#import "THEMultipeerSessionStateDelegate.h"
#import "THEMultipeerServerConnectionDelegate.h"

// Encapsulates the local client functionality such as discovering and 
// connecting to remote servers.
@interface THEMultipeerClient : NSObject <MCNearbyServiceBrowserDelegate, THEMultipeerServerConnectionDelegate>

// Service type here is what we're looking for, not what we may be advertising 
// (although they'll usually be the same)

- (instancetype)initWithPeerId:(MCPeerID *)peerId
                 withServiceType:(NSString *)serviceType
              withPeerIdentifier:(NSString *)peerIdentifier
             withSessionDelegate:(id<THEMultipeerSessionStateDelegate>)sessionDelegate
  withMultipeerDiscoveryDelegate:(id<THEMultipeerDiscoveryDelegate>)discoveryDelegate;

// Start and stop the client (i.e. the peer discovery process)
- (void)start;
- (void)stop;

// Restart browsing without killing existing sessions
- (void)restart;

// Connect to a remote peer identified by the application level identifier,
- (BOOL)connectToPeerWithPeerIdentifier:(NSString *)peerIdentifier
                    withConnectCallback:(ClientConnectCallback)connectCallback;

// Kill connection for testing purposes
- (BOOL)killConnections:(NSString *)peerIdentifier;

- (const THEMultipeerClientSession *)sessionForUUID:(NSString *)peerUUID;

- (void)updateLocalPeerIdentifier:(NSString *)localPeerIdentifier;

// The server component is telling us it just completed a connection, it may be one
// we initiated.
- (void)didCompleteReverseConnection:(NSString *)peerIdentifier
                      withClientPort:(unsigned short)clientPort
                      withServerPort:(unsigned short)serverPort;
@end
