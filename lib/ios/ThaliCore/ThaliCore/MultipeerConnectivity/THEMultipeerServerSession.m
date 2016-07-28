//
//  THEMultipeerServerSession.m
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
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
