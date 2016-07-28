//
//  THEMultipeerSession.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <MultipeerConnectivity/MultipeerConnectivity.h>

#import "THEMultipeerSocketRelay.h"

typedef NS_ENUM(NSUInteger, THEPeerSessionState) {
  THEPeerSessionStateNotConnected  = 0,
  THEPeerSessionStateConnecting    = 1,
  THEPeerSessionStateConnected     = 2
};

// Encapsulates a discovered peer, their connection state and resources.
// Any peer that has been discovered  will have a MultipeerPeerSession object although 
// they may not currently be visible or connected. 
// The underlying connection transport may be any available e.g. Bluetooth, WiFi etc.
@interface THEMultipeerPeerSession : NSObject <MCSessionDelegate>

- (instancetype)initWithLocalPeerID:(MCPeerID *)localPeerID 
                   withRemotePeerID:(MCPeerID *)remotePeerID
           withRemotePeerIdentifier:(NSString *)peerIdentifier
                    withSessionType:(NSString *)sessionType;

- (MCPeerID *)remotePeerID;
- (NSString *)remotePeerUUID;
- (NSString *)remotePeerIdentifier;
- (THEPeerSessionState)connectionState;

- (void)updateRemotePeerIdentifier:(NSString *)remotePeerIdentifier;

- (MCSession *)session;

- (void)connect;
- (void)reverseConnect;

- (void)disconnect;

// Kill for testing only !!
- (void)kill;

// Called when the p2p link fails
- (void)onLinkFailure;

// Accessor for the relay
- (const THEMultipeerSocketRelay *)relay;

+ (NSString *)peerUUIDFromPeerIdentifier:(NSString *)peerIdentifier;

- (void)changeState:(THEPeerSessionState)newState;

@end

