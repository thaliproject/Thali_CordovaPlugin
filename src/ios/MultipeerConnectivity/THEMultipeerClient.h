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
//  THEMultipeerClient.h

#import <MultipeerConnectivity/MultipeerConnectivity.h>
#import "THEMultipeerSession.h"

// Encapsulates the local client functionality such as discovering and 
// connecting to remote servers.
@interface MultipeerClient : NSObject <MCNearbyServiceBrowserDelegate>

// Service type here is what we're looking for, not what we may be advertising 
// (although they'll usually be the same)
-(id) initWithPeerId:(MCPeerID *)peerId 
                        withServiceType:(NSString *)serviceType 
             withPeerNetworkingDelegate:(id<THEMultipeerSessionDelegate>)multipeerSessionDelegate;

// Start and stop the client (i.e. the peer discovery process)
-(void) start;
-(void) stop;

// Connect to a remote peer identified by the application level identifier
-(BOOL) connectToPeerWithPeerIdentifier:(NSString *)peerIdentifier;

// Disconnect to a remote peer identified by the application level identifier
-(BOOL) disconnectFromPeerWithPeerIdentifier:(NSString *)peerIdentifier;

@end
