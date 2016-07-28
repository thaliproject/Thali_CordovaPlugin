//
//  THEMultipeerSessionStateDelegate.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import "THEMultipeerClientSession.h"
#import "THEMultipeerServerSession.h"

// Protocol implemented by classes wishing to know global session state
@protocol THEMultipeerSessionStateDelegate <NSObject>

- (const THEMultipeerClientSession *)clientSession:(NSString *)peerIdentifier;
- (const THEMultipeerServerSession *)serverSession:(NSString *)peerIdentifier;

@end


