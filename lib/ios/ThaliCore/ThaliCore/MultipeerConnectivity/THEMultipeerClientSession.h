//
//  THEMultipeerClientSession.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import "THEAppContext.h"
#import "THEMultipeerPeerSession.h"
#import "THEMultipeerClientSocketRelayDelegate.h"

// Session type managed by clients (and so references a remote server)
@interface THEMultipeerClientSession : THEMultipeerPeerSession <THEMultipeerClientSocketRelayDelegate>

@property (atomic) BOOL visible;

// Clients need to specialise connect in order to receive the connect callback
- (void)connectWithConnectCallback:(ClientConnectCallback)connectCallback;

- (instancetype)initWithLocalPeerID:(MCPeerID *)localPeerID
                   withRemotePeerID:(MCPeerID *)remotePeerID
           withRemotePeerIdentifier:(NSString *)remotePeerIdentifier;

//
- (void)onPeerLost;

@end


