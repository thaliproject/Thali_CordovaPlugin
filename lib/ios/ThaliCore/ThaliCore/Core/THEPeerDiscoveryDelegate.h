//
//  THEPeerDiscoveryDelegate.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

// Defines the interface through which the multipeer session will 
// inform it's delegate about the visibility of peers
@protocol THEPeerDiscoveryDelegate <NSObject>

// Notifies the delegate that a peer was found.
- (void)didFindPeer:(NSDictionary *)peer;

// Notifies the delegate that a peer was lost.
- (void)didLosePeer:(NSString *)peerIdentifier;

@end
