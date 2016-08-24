//
//  THEMultipeerServerSession.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import "THEMultipeerPeerSession.h"
#import "THEMultipeerServerSocketRelay.h"

typedef void (^ServerConnectCallback)(NSString *, unsigned short, unsigned short);

// The sesssion type managed by a server (and so references a client)
@interface THEMultipeerServerSession : THEMultipeerPeerSession <THEMultipeerServerSocketRelayDelegate>

- (id)initWithLocalPeerID:(MCPeerID *)localPeerID
         withRemotePeerID:(MCPeerID *)remotePeerID
       withRemotePeerIdentifier:(NSString *)peerIdentifier
           withServerPort:(uint)serverPort;

- (void)connectWithConnectCallback:(ServerConnectCallback)connectCallback;

- (unsigned short)clientPort;
- (unsigned short)serverPort;

@end
