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
//  THEMultipeerServer.h
//

#import <MultipeerConnectivity/MultipeerConnectivity.h>

#import "THEMultipeerPeerSession.h"
#import "THEMultipeerDiscoveryDelegate.h"
#import "THEMultipeerSessionStateDelegate.h"

// Encapsulate the local server, handles advertising the serviceType and accepting
// connections from remote clients
@interface THEMultipeerServer : NSObject <MCNearbyServiceAdvertiserDelegate>

- (instancetype)initWithPeerID:(MCPeerID *)peerID
            withPeerIdentifier:(NSString *)peerIdentifier
               withServiceType:(NSString *)serviceType
                withServerPort:(unsigned short)serverPort
withMultipeerDiscoveryDelegate:(id<THEMultipeerDiscoveryDelegate>)multipeerDiscoveryDelegate
      withSessionStateDelegate:(id<THEMultipeerSessionStateDelegate>)sessionStateDelegate;


// Start/stop advertising
- (void)start;
- (void)stop;

// Restart advertising without killing existing sessions
- (void)restart;

// Set reset callback for managing restarts
- (void)setTimerResetCallback:(void (^)(void))timerCallback;

- (const THEMultipeerServerSession *)session:(NSString *)peerIdentifier;

@end
