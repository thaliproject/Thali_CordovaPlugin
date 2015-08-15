//
//  The MIT License (MIT)
//
//  Copyright (c) 2015 Microsoft
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//  THE SOFTWARE.
//
//  Thali CordovaPlugin
//  THEPeerNetworking.h
//

#import <Foundation/Foundation.h>

#import "THEPeerNetworkingDelegate.h"

// Wraps all the functionality of the networking stack and presents to the upper layers.
// Contains both client and server members which will discover and connect (the client) and
// advertise and accept (the server) connections from remote peers.
@interface THEPeerNetworking : NSObject

@property (nonatomic, weak) id<THEPeerNetworkingDelegate> delegate;

// Class initializer.
- (instancetype)initWithServiceType:(NSString *)serviceType
                     peerIdentifier:(NSString *)peerIdentifier
                           peerName:(NSString *)peerName;

// Starts peer networking.
- (void)start;

// Stops peer networking.
- (void)stop;

// Connects to the peer server with the specified peer identifier.
- (BOOL)connectToPeerServerWithPeerIdentifier:(NSString *)peerIdentifier;

// Connects from the peer server with the specified peer identifier.
- (BOOL)disconnectFromPeerServerWithPeerIdentifier:(NSString *)peerIdentifier;

@end
