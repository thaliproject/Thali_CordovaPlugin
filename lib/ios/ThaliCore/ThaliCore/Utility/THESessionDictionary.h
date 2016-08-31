//
//  THESessionDictionary.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <MultipeerConnectivity/MultipeerConnectivity.h>

#import "THEProtectedMutableDictionary.h"
#import "THEMultipeerPeerSession.h"

// Specialisation of the the protected mutable dict class for conveniently working with 
// peer sessions
@interface THESessionDictionary : THEProtectedMutableDictionary

-(void)updateForPeerID:(MCPeerID *)peerID 
           updateBlock:(THEMultipeerPeerSession *(^)(THEMultipeerPeerSession *))updateBlock;

-(void)updateForPeerUUID:(NSString *)peerUUID
                   updateBlock:(THEMultipeerPeerSession *(^)(THEMultipeerPeerSession *))updateBlock;

@end
