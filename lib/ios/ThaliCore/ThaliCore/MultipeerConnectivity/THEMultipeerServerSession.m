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
//  THEMultipeerServerSession.m
//

#import "THEMultipeerServerSession.h"
#import "THEMultipeerServerSocketRelay.h"

@implementation THEMultipeerServerSession
{
  unsigned short _serverPort;
  unsigned short _clientPort;
  ServerConnectCallback _connectCallback;
}

- (instancetype)initWithLocalPeerID:(MCPeerID *)localPeerID
                   withRemotePeerID:(MCPeerID *)remotePeerID
           withRemotePeerIdentifier:(NSString *)remotePeerIdentifier
                     withServerPort:(uint)serverPort
{
  self = [super initWithLocalPeerID:localPeerID 
                   withRemotePeerID:remotePeerID 
           withRemotePeerIdentifier:remotePeerIdentifier 
                    withSessionType:@"server"];
  if (!self)
  {
    return nil;
  }
  
  _clientPort = 0;
  _serverPort = serverPort;
  _connectCallback = nil;
  
  return self;
}

- (void)connectWithConnectCallback:(ServerConnectCallback)connectCallback
{
  @synchronized(self)
  {
    assert(_connectCallback == nil);

    _connectCallback = connectCallback;
    [super connect];
  }
}

- (unsigned short)clientPort
{
  return _clientPort;
}

- (unsigned short)serverPort
{
  return _serverPort;
}

- (THEMultipeerSocketRelay *)newSocketRelay
{
  return [[THEMultipeerServerSocketRelay alloc] initWithServerPort:_serverPort withDelegate:self];
}

- (void)didConnectWithClientPort:(unsigned short)clientPort withServerPort:(unsigned short)serverPort
{
  @synchronized(self)
  {
    _clientPort = clientPort;
    [self changeState:THEPeerSessionStateConnected];

    if (_connectCallback)
    {
      _connectCallback([self remotePeerUUID], clientPort, serverPort);
      _connectCallback = nil;
    }
  }
}

- (void)didNotConnectWithServerPort:(unsigned short)serverPort
{
  @synchronized(self)
  {
    if (_connectCallback)
    {
      _connectCallback([self remotePeerIdentifier], 0, 0);
      _connectCallback = nil;
    }
  }
}

@end
