//
//  THEMultipeerDiscoveryDelegate.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <MultipeerConnectivity/MultipeerConnectivity.h>

// Defines the interface through which the multipeer session will
// inform it's delegate about the visibility of peers
@protocol THEMultipeerDiscoveryDelegate <NSObject>

// Notifies the delegate that a peer was found and whether a
// reverse connection is being requested
- (void)didFindPeerIdentifier:(NSString *)peer pleaseConnect:(BOOL)pleaseConnect;

// Notifies the delegate that a peer was lost.
- (void)didLosePeerIdentifier:(NSString *)peerIdentifier;

@end
