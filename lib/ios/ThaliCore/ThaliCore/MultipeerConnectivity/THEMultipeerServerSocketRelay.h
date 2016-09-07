//
//  THEMultipeerServerSocketRelay.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <Foundation/Foundation.h>
#import <MultipeerConnectivity/MultipeerConnectivity.h>

#import "THEMultipeerSocketRelay.h"
#import "THEMultipeerServerSocketRelayDelegate.h"

@interface THEMultipeerServerSocketRelay : THEMultipeerSocketRelay

-(instancetype)initWithServerPort:(unsigned short)serverPort withDelegate:(id<THEMultipeerServerSocketRelayDelegate>)delegate;

@end
