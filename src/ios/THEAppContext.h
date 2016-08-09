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
//  THEAppContext.h
//

#import <Foundation/Foundation.h>

#import "THEThaliEventDelegate.h"
#import "THEPeerDiscoveryDelegate.h"
#import "THERemoteConnectionDelegate.h"

// Callback that will be called when the lower levels have established
// a client relay in response to a connect
typedef void(^ClientConnectCallback)(NSString *error, NSDictionary *connection);

// THEAppContext interface.
@interface THEAppContext : NSObject <THEPeerDiscoveryDelegate, THERemoteConnectionDelegate>

// Set the event delegate
- (void)setThaliEventDelegate:(id<THEThaliEventDelegate>) eventDelegate;

// Start the client components
- (BOOL)startListeningForAdvertisements;

// Stop the client components
- (BOOL)stopListeningForAdvertisements;

// Start the server components
- (BOOL)startUpdateAdvertisingAndListening:(unsigned short)serverPort;

// Stop the server components
- (BOOL)stopAdvertisingAndListening;

// Connects to the peer with the specified peer identifier.
- (BOOL)connectToPeer:(NSString *)peerIdentifier connectCallback:(ClientConnectCallback)connectCallback;

// Kill connection without cleanup - Testing only !!
- (BOOL)killConnections:(NSString *)peerIdentifier;

- (void)didFindPeer:(NSDictionary *)peer;
- (void)didLosePeer:(NSString *)peerIdentifier;

// Allow external component to force us to fire event
- (void)fireNetworkChangedEvent;

#ifdef DEBUG
// A set of functions which make testing a lot easier
- (void)setPeerIdentifier:(NSString *)peerIdentifier;
#endif

@end
