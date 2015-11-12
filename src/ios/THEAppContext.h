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
#import "THEMultipeerDiscoveryDelegate.h"
#import "THEPeerBluetoothDelegate.h"

// Callback that will be called when the lower levels have established
// a client relay in response to a connect
typedef void(^ConnectCallback)(NSString *error, uint port);

// THEAppContext interface.
@interface THEAppContext : NSObject <THEMultipeerDiscoveryDelegate, THEPeerBluetoothDelegate>

// Class singleton.
+ (instancetype)singleton;

// Starts communications.
- (BOOL)startBroadcasting:(NSString *)peerIdentifier serverPort:(NSNumber *)serverPort;

// Stops communications.
- (BOOL)stopBroadcasting;

// Connects to the peer with the specified peer identifier.
- (BOOL)connectToPeer:(NSString *)peerIdentifier connectCallback:(ConnectCallback)connectCallback;

// Disconnects from the peer with the specified peer idetifier.
- (BOOL)disconnectFromPeer:(NSString *)peerIdentifier;

// Kill connection without cleanup - Testing only !!
- (BOOL)killConnection:(NSString *)peerIdentifier;

@end
