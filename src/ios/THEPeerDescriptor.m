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

// THEPeerDescriptor implementation.
@implementation THEPeerDescriptor

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
    _inputStream = inputStream;
    [self tryCreateTCPRelay];
}

-(void)setOutputStream:(NSOutputStream *)outputStream
{
    _outputStream = outputStream;
    [self tryCreateTCPRelay];
}

-(void)tryCreateTCPRelay
{
    // Fake an abstract class
    [self doesNotRecognizeSelector:_cmd];
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
 
    return self;
}

-(void)tryCreateTCPRelay
{
    if (self.inputStream != nil && self.outputStream != nil)
    {
        if (_clientRelay == nil)
        {
            _clientRelay = [[THENetworkingClientRelay alloc] 
                initWithInputStream:self.inputStream 
                withOutputStream:self.outputStream
                withPeerIdentifier:_peerIdentifier
            ];

            [_clientRelay setDelegate:(id<THEConnectionStatusDelegate>)[THEAppContext singleton]];

            if ([_clientRelay start])
            {
                [self setConnectionState:THEPeerDescriptorStateConnected];
            }
            else
            {
                NSLog(@"Error failed to start ServerRelay!");
            }
        }
        else
        {
            NSLog(@"Error already setup a ServerRelay bridge!");
        }
    }
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
 
    return self;
}


-(void) tryCreateTCPRelay
{
    if (self.inputStream != nil && self.outputStream != nil)
    {
        if (_serverRelay == nil)
        {
            _serverRelay = [[THENetworkingServerRelay alloc] 
                initWithInputStream:self.inputStream 
                withOutputStream:self.outputStream
                withServerPort:_serverPort
            ];

            if ([_serverRelay start])
            {
                [self setConnectionState:THEPeerDescriptorStateConnected];
            }
            else
            {
                NSLog(@"Error failed to start ClientRelay!");
            }
        }
        else
        {
            NSLog(@"Error already setup a ClientRelay bridge!");
        }
    }
}

@end
