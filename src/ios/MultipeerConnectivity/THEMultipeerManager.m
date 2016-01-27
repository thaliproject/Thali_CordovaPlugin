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
//  THEMultipeerManager.m
//

#import <pthread.h>
#import <MultipeerConnectivity/MultipeerConnectivity.h>

#import "THEMultipeerManager.h"
#import "THEMultipeerClient.h"
#import "THEMultipeerServer.h"

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
  
  // Restart timer
  // NSTimer *_restartTimer;

  __weak id<THEPeerDiscoveryDelegate> _peerDiscoveryDelegate;
}

- (instancetype)initWithServiceType:(NSString *)serviceType
                     withPeerIdentifier:(NSString *)peerIdentifier
          withPeerDiscoveryDelegate:(id<THEPeerDiscoveryDelegate>)delegate;
{
  self = [super init];
    
  if (!self)
  {
      return nil;
  }
  
  _peerDiscoveryDelegate = delegate;
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
  }

  return true;

  /*__weak typeof(self) weakSelf = self;
  [_server setTimerResetCallback: ^void (void) {
    // Reset the restart timer
    NSLog(@"multipeer session: reset timer");
    [weakSelf stopRestartTimer];
    [weakSelf startRestartTimer];
  }];
  */

  // Kick off the restart timer
  // [self startRestartTimer];
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
    if (_isListening)
      return false;
    
    [self stopClient];
    _isListening = true;
    [self startClient];
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
  // client so let the client have a look..
  if (_client)
  {
    [_client didCompleteReverseConnection:peerIdentifier
                           withClientPort:clientPort
                           withServerPort:serverPort];
  }
}

/*- (void)startRestartTimer
{
  // Set a timer that, if it ever fires, will restart browsing and advertising
  NSLog(@"multipeer session: start timer: %p", self);

  OnMainThread(^{
    assert([NSThread isMainThread]);
    _restartTimer = [NSTimer scheduledTimerWithTimeInterval:30
                                                     target:self
                                                   selector:@selector(restart:)
                                                   userInfo:nil
                                                    repeats:YES];
  });
}

- (void)stopRestartTimer
{
  NSLog(@"multipeer session: stop timer");
  [_restartTimer invalidate];
}
*/

/*- (void)restart:(NSTimer *)timer
{
  NSLog(@"multipeer session: restart");
  [_server restart];
  [_client restart];
}*/

- (BOOL)connectToPeerWithPeerIdentifier:(NSString *)peerIdentifier
                          withConnectCallback:(ClientConnectCallback)connectCallback
{
  // Connect to a previously discovered peer
  return [_client connectToPeerWithPeerIdentifier:peerIdentifier 
                              withConnectCallback:connectCallback];
}

- (BOOL)killConnection:(NSString *)peerIdentifier
{
  // Cause trouble for testing purposes
  //return [_client killConnection:peerIdentifier];
  return false;
}

@end
