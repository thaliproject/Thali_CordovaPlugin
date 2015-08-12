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
//  THEPeerDescriptor.h
//

#import "THENetworkingServerRelay.h"
#import "THENetworkingClientRelay.h"
#import <MultipeerConnectivity/MultipeerConnectivity.h>

// THEPeerDescriptorState enumeration.
typedef NS_ENUM(NSUInteger, THEPeerDescriptorState)
{
    THEPeerDescriptorStateNotConnected  = 0,
    THEPeerDescriptorStateConnecting    = 1,
    THEPeerDescriptorStateConnected     = 2
};

@interface THEPeerDescriptor : NSObject

    @property (nonatomic) BOOL visible;
    @property (nonatomic) MCPeerID * peerID;
    @property (nonatomic) THEPeerDescriptorState connectionState;
    @property (nonatomic) NSInputStream * inputStream;
    @property (nonatomic) NSOutputStream * outputStream;
    
    - (instancetype)initWithPeerID:(MCPeerID *)peerID;
    - (void)tryCreateTCPRelay;

@end

@interface THEServerPeerDescriptor : THEPeerDescriptor

    @property (nonatomic) uint connectRetries;
    @property (nonatomic) MCSession * clientSession;

    @property (nonatomic) NSString * peerIdentifier;
    @property (nonatomic) NSString * peerName;
    @property (nonatomic, strong) THENetworkingClientRelay * clientRelay;

    - (instancetype)initWithPeerID:(MCPeerID *)peerID
                withPeerIdentifier:(NSString *)peerIdentifier
                      withPeerName:(NSString *)peerName;
@end;

@interface THEClientPeerDescriptor : THEPeerDescriptor
    @property (nonatomic) uint serverPort;
    @property (nonatomic, strong) THENetworkingServerRelay * serverRelay;
    - (instancetype)initWithPeerID:(MCPeerID *)peerID withServerPort:(uint)serverPort;
@end
