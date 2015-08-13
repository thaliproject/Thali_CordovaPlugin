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
//  THEPeerDescriptor.m
//

#import "THEAppContext.h"
#import "THEPeerDescriptor.h"

@implementation THEPeerDescriptor
{
@protected
    THENetworkingRelay *_relay;
}

- (instancetype)initWithPeerID:(MCPeerID *)peerID
{
    self = [super init];
    if (!self)
    {
        return nil;
    }
    
    _peerID = peerID;

    return self;
}

-(void)setInputStream:(NSInputStream *)inputStream
{
    [_relay setInputStream:inputStream];
}

-(void)setOutputStream:(NSOutputStream *)outputStream
{
    [_relay setOutputStream:outputStream];
}

-(void)disconnect
{
    _relay = nil;
}

@end

@implementation THEServerPeerDescriptor

- (instancetype)initWithPeerID:(MCPeerID *)peerID
            withPeerIdentifier:(NSString *)peerIdentifier
                  withPeerName:(NSString *)peerName
{
    self = [super initWithPeerID:peerID];
    if (!self)
    {
        return nil;
    }

    _peerIdentifier = peerIdentifier;
    _peerName = peerName;
   
    THENetworkingClientRelay *clientRelay = [[THENetworkingClientRelay alloc] initWithPeerIdentifier:_peerIdentifier];
    [clientRelay setDelegate:(id<THESocketServerDelegate>)[THEAppContext singleton]];
    
    _relay = clientRelay;
 
    return self;
}

@end

@implementation THEClientPeerDescriptor

- (instancetype)initWithPeerID:(MCPeerID *)peerID
                withServerPort:(uint)serverPort
{
    self = [super initWithPeerID:peerID];
    if (!self)
    {
        return nil;
    }
    
    _serverPort = serverPort;
    _relay = [[THENetworkingServerRelay alloc] initWithServerPort:_serverPort];

    return self;
}

@end
