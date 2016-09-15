//
//  THEMultipeerSession.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <Foundation/Foundation.h>

#import "THEAppContext.h"
#import "THEPeerDiscoveryDelegate.h"
#import "THERemoteConnectionDelegate.h"

// Co-ordinates the actions of the MPCF client and server components
@interface THEMultipeerManager : NSObject
 
// Class initializer.
- (instancetype)initWithServiceType:(NSString *)serviceType
                 withPeerIdentifier:(NSString *)peerIdentifier
          withPeerDiscoveryDelegate:(id<THEPeerDiscoveryDelegate>)peerDiscoveryDelegate
       withRemoteConnectionDelegate:(id<THERemoteConnectionDelegate>)remoteConnectionDelegate;

// Starts multipeer session both discovering and advertising
- (BOOL)startServerWithServerPort:(unsigned short)serverPort;
- (BOOL)stopServer;

- (BOOL)startListening;
- (BOOL)stopListening;

// Connects to the peer with the specified peer identifier. |connectCallback| will
// be called when the connection completes with first param being any error message or nil and
// second param being the port number the relay is listening on
- (BOOL)connectToPeerWithPeerIdentifier:(NSString *)peerIdentifier
                    withConnectCallback:(ClientConnectCallback)connectCallback;

// Kill the connection without clean-up. Testing only !!
- (BOOL)killConnections:(NSString *)peerIdentifier;

// Allow external components to see our current id
- (NSString *)localPeerIdentifier;

- (BOOL)isListening;
- (BOOL)isAdvertising;

@end
