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
//  THEMultipeerSession.h
//

#import <Foundation/Foundation.h>

#import "THEAppContext.h"
#import "THEMultipeerSessionDelegate.h"

// Wraps all the functionality of the networking stack and presents to the upper layers.
// Contains both client and server members which will discover and connect (the client) and
// advertise and accept (the server) connections from remote peers.
@interface THEMultipeerSession : NSObject
 
// Class initializer.
- (instancetype)initWithServiceType:(NSString *)serviceType
                     peerIdentifier:(NSString *)peerIdentifier
                           peerName:(NSString *)peerName
                    sessionDelegate:(id<THEMultipeerSessionDelegate>)delegate;

// Starts multipeer session both discovering and advertising, will stop only on destruction
// of the instance
- (void)start;

// Connects to the peer server with the specified peer identifier. |connectCallback| will
// be called when the connection completes with first param being any error message or nil and
// second param being the port number the relay is listening on
- (BOOL)connectToPeerServerWithPeerIdentifier:(NSString *)peerIdentifier 
                          withConnectCallback:(ConnectCallback)connectCallback;

// Connects from the peer server with the specified peer identifier.
- (BOOL)disconnectFromPeerServerWithPeerIdentifier:(NSString *)peerIdentifier;

// Kill the connection without clean-up. Testing only !!
- (BOOL)killConnection:(NSString *)peerIdentifier;

@end
