//
//  THEMultipeerManager.m
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <MultipeerConnectivity/MultipeerConnectivity.h>

#import "THEMultipeerManager.h"
#import "THEMultipeerClient.h"
#import "THEMultipeerServer.h"

#import "THEMultipeerDiscoveryDelegate.h"
#import "THEMultipeerSessionStateDelegate.h"
#import "THEMultipeerServerConnectionDelegate.h"

@interface THEMultipeerManager () <THEMultipeerDiscoveryDelegate, THEMultipeerServerConnectionDelegate, THEMultipeerSessionStateDelegate>

@end

// THEMultipeerManager implementation.
@implementation THEMultipeerManager
{
  // Application level identifiers
  NSString * _serviceType;
  
  NSString * _peerUUID;
  NSString * _peerIdentifier;

  // Our local peer id
  MCPeerID * _peerID;
 
  // Are we *really* listening or do we just have a
  // client running ?
  bool _isListening;
  
  // Mutex used to synchronize access to the things below.
  // The multipeer client which will handle browsing and connecting for us
  THEMultipeerClient *_client;

  // The multipeer server which will handle advertising our service and accepting 
  // connections from remote clients, it may also initiate reverse connection
  // through this manager component
  THEMultipeerServer *_server;

  unsigned int _serverGeneration;
  
  // Restart timers
  NSTimer *_serverRestartTimer;
  NSTimer *_clientRestartTimer;

  __weak id<THEPeerDiscoveryDelegate> _peerDiscoveryDelegate;
  __weak id<THERemoteConnectionDelegate> _remoteConnectionDelegate;
}

- (instancetype)initWithServiceType:(NSString *)serviceType
                     withPeerIdentifier:(NSString *)peerIdentifier
          withPeerDiscoveryDelegate:(id<THEPeerDiscoveryDelegate>)discoveryDelegate
       withRemoteConnectionDelegate:(id<THERemoteConnectionDelegate>)remoteConnectionDelegate
{
  self = [super init];
    
  if (!self)
  {
      return nil;
  }
  
  _peerDiscoveryDelegate = discoveryDelegate;
  _remoteConnectionDelegate = remoteConnectionDelegate;
  
  _serviceType = serviceType;

  _peerID = [[MCPeerID alloc] initWithDisplayName: [[UIDevice currentDevice] name]];

  _peerUUID = peerIdentifier;
  _peerIdentifier = [peerIdentifier stringByAppendingString:@":0"];
  
  _serverGeneration = 0;

  return self;
}

- (NSString *)localPeerIdentifier
{
  return _peerIdentifier;
}

- (BOOL)isListening
{
  return _isListening;
}

- (BOOL)isAdvertising
{
  return (_server != nil);
}

// Starts peer networking.
- (BOOL)startServerWithServerPort:(unsigned short)serverPort
{
  @synchronized(self)
  {
    if (_server)
      [self stopServer];

    // Increment the generation counter at the end of peerId

    // Start up the networking components
    _peerIdentifier = [
      _peerUUID stringByAppendingString:[NSString stringWithFormat:@":%d", ++_serverGeneration]
    ];
    
    _server = [[THEMultipeerServer alloc] initWithPeerID:_peerID
                                      withPeerIdentifier:_peerIdentifier
                                         withServiceType:_serviceType
                                          withServerPort:serverPort
                          withMultipeerDiscoveryDelegate:self
                                withSessionStateDelegate:self
                   withMultipeerServerConnectionDelegate:self];
    [_server start];

    // We *need* a client to perform reverse connections on
    [self startClient];
    
    NSLog(@"THEMultipeerManager initialized peer %@", _peerIdentifier);

    __weak __typeof(self) weakSelf = self;
    [_server setTimerResetCallback: ^void (void) {
      // Reset the restart timer
      NSLog(@"multipeer session: reset timer");
      [weakSelf stopServerRestartTimer];
      [weakSelf startServerRestartTimer];
    }];
    
    // Kick off the restart timer
    [self startServerRestartTimer];
  }

  return true;
}

- (BOOL)stopServer
{
  @synchronized(self)
  {
    NSLog(@"THEMultipeerManager stopping peer");

    if (_server)
    {
      [_server stop];
      _server = nil;
      [self stopServerRestartTimer];
    }
    
    if (!_isListening)
    {
      [self stopClient];
    }
  }
  
  return true;
}

- (BOOL)startListening
{
  @synchronized(self)
  {
    if (!_isListening)
    {
        [self startClient];
    }
    _isListening = true;
  }
  return true;
}

- (BOOL)stopListening
{
  @synchronized(self)
  {
    _isListening = false;
    if (!_server)
    {
      [self stopClient];
    }
  }
  return true;
}

- (BOOL)startClient
{
  @synchronized(self)
  {
    if (!_client)
    {
      _client = [[THEMultipeerClient alloc] initWithPeerId:_peerID
                                           withServiceType:_serviceType
                                        withPeerIdentifier:_peerIdentifier
                                       withSessionDelegate:self
                            withMultipeerDiscoveryDelegate:self];
      [_client start];
      [self startClientRestartTimer];
      
      return true;
    }
    else
    {
      [_client updateLocalPeerIdentifier:_peerIdentifier];
    }
  }

  return false;
}

- (BOOL)stopClient
{
  @synchronized(self)
  {
    if (_client)
    {
      [_client stop];
       _client = nil;
      [self stopClientRestartTimer];
    }
  }
  return true;
}

- (const THEMultipeerClientSession *)clientSession:(NSString *)peerIdentifier
{
  NSString *uuid = [peerIdentifier componentsSeparatedByString:@":"][0];
  return [_client sessionForUUID:uuid];
}

- (const THEMultipeerServerSession *)serverSession:(NSString *)peerIdentifier
{
  NSString *uuid = [peerIdentifier componentsSeparatedByString:@":"][0];
  return [_server sessionForUUID:uuid];
}

- (void)didFindPeerIdentifier:(NSString *)peerIdentifier pleaseConnect:(BOOL)pleaseConnect
{
  @synchronized(self)
  {
    if (_isListening)
    {
      if (_peerDiscoveryDelegate)
      {
        NSDictionary *peer = @{
          @"peerIdentifier" : peerIdentifier,
          @"peerAvailable" : @true,
          @"pleaseConnect" : pleaseConnect ? @true : @false
        };
        
        [_peerDiscoveryDelegate didFindPeer:peer];
      }
    }
  }
}

- (void)didLosePeerIdentifier:(NSString *)peerIdentifier
{
  @synchronized(self)
  {
    if (_isListening)
    {
      if (_peerDiscoveryDelegate)
      {
        [_peerDiscoveryDelegate didLosePeer:peerIdentifier];
      }
    }
  }
}

- (void)didCompleteReverseConnection:(NSString *)peerIdentifier
                      withClientPort:(unsigned short)clientPort
                      withServerPort:(unsigned short)serverPort
{
  // The server's just completed a connection, it may be a reverse connection initiated by the
  // client
  
  // It may also be a standard remote initiated connection which, if it's failed, we need
  // to tell someone about
  if (_remoteConnectionDelegate)
  {
    if (clientPort == 0)
    {
      [_remoteConnectionDelegate didNotAcceptConnectionWithServerPort:serverPort];
    }
  }
  
  if (_client)
  {
    [_client didCompleteReverseConnection:peerIdentifier
                           withClientPort:clientPort
                           withServerPort:serverPort];
  }
}

- (void)startServerRestartTimer
{
  // Set a timer that, if it ever fires, will restart browsing and advertising
/*  NSLog(@"multipeer manager: start server restart timer: %p", self);

  dispatch_async(dispatch_get_main_queue(), ^{
    _serverRestartTimer = [NSTimer scheduledTimerWithTimeInterval:20
                                                           target:self
                                                         selector:@selector(serverClient:)
                                                         userInfo:nil
                                                          repeats:YES];
    }
  );
 
  [[NSRunLoop mainRunLoop] addTimer:_serverRestartTimer forMode:NSRunLoopCommonModes];
*/
}

- (void)stopServerRestartTimer
{
  /*NSLog(@"multipeer manager: stop server timer");
  @synchronized(self)
  {
    [_serverRestartTimer invalidate];
    _serverRestartTimer = nil;
  }*/
}

- (void)startClientRestartTimer
{
  // Set a timer that, if it ever fires, will restart browsing and advertising
  NSLog(@"multipeer manager: start client restart timer: %p", self);

  dispatch_async(dispatch_get_main_queue(), ^{
    _clientRestartTimer = [NSTimer scheduledTimerWithTimeInterval:20
                                                           target:self
                                                         selector:@selector(restartClient:)
                                                         userInfo:nil
                                                          repeats:YES];
    }
  );
}

- (void)stopClientRestartTimer
{
  NSLog(@"multipeer manager: stop client timer");
  @synchronized(self)
  {
    [_clientRestartTimer invalidate];
    _clientRestartTimer = nil;
  }
}

- (void)restartClient:(NSTimer *)timer
{
  NSLog(@"multipeer manager: restart client");
  [_client restart];
}

- (void)restartServer:(NSTimer *)timer
{
  NSLog(@"multipeer manager: restart server");
  [_server restart];
}

- (BOOL)connectToPeerWithPeerIdentifier:(NSString *)peerIdentifier
                          withConnectCallback:(ClientConnectCallback)connectCallback
{
  // Connect to a previously discovered peer
  @synchronized(self)
  {
    if (!_client)
    {
      connectCallback(@"Start browsing first", 0);
      return NO;
    }
    
    return [_client connectToPeerWithPeerIdentifier:peerIdentifier
                                withConnectCallback:connectCallback];
  }
}

- (BOOL)killConnections:(NSString *)peerIdentifier
{
  // Cause trouble for testing purposes
  return [_client killConnections:peerIdentifier];
}

@end
