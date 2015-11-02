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
//  THEMultipeerSession.m
//

#import <pthread.h>
#include "jx.h"
#import "JXcore.h"
#import "THEThreading.h"
#import <MultipeerConnectivity/MultipeerConnectivity.h>
#import "THEMultipeerSession.h"
#import "THEMultipeerClient.h"
#import "THEMultipeerServer.h"

// THEMultipeerSession implementation.
@implementation THEMultipeerSession
{
  // Application level identifiers
  NSString * _serviceType;
  NSString * _peerIdentifier;
  NSString * _peerName;

  // Our local peer id
  MCPeerID * _peerID;
   
  // Mutex used to synchronize access to the things below.
  pthread_mutex_t _mutex;

  // The multipeer client which will handle browsing and connecting for us
  THEMultipeerClient *_client;

  // The multipeer server which will handle advertising out service and accepting 
  // connections from remote clients
  THEMultipeerServer *_server;

  // Restart timer
  NSTimer *_restartTimer;

  __weak id<THEMultipeerDiscoveryDelegate> _delegate; 
}

- (instancetype)initWithServiceType:(NSString *)serviceType
                     peerIdentifier:(NSString *)peerIdentifier
                           peerName:(NSString *)peerName
                  discoveryDelegate:(id<THEMultipeerDiscoveryDelegate>)delegate
{
    self = [super init];
    
    if (!self)
    {
        return nil;
    }
   
    _delegate = delegate;
 
    _serviceType = serviceType;
    _peerIdentifier = peerIdentifier;
    _peerName = peerName;

    pthread_mutex_init(&_mutex, NULL);
    
    return self;
}

// Starts peer networking.
- (void)start
{
  assert(_delegate != nil);

  _peerID = [[MCPeerID alloc] initWithDisplayName: [[UIDevice currentDevice] name]];
 
  // Start up the networking components  
  _server = [[THEMultipeerServer alloc] initWithPeerId: _peerID 
    withPeerIdentifier: _peerIdentifier withPeerName: _peerName withServiceType: _serviceType
  ];

  _client = [[THEMultipeerClient alloc] 
              initWithPeerId:_peerID 
          withPeerIdentifier:_peerIdentifier 
             withServiceType:_serviceType 
       withDiscoveryDelegate:_delegate];

  __weak typeof(self) weakSelf = self;
  [_server setTimerResetCallback: ^void (void) {
    // Restart the restart timer
    NSLog(@"multipeer session: restart timer");
    [weakSelf stopRestartTimer];
    [weakSelf startRestartTimer];
  }];
  
  [_server start];
  [_client start];

  NSLog(@"THEMultipeerSession initialized peer %@", _peerIdentifier);
}

- (void)startRestartTimer
{
  SEL _restart = NSSelectorFromString(@"restart:");
  // Set a timer that, if it ever fires, will restart browsing and advertising
  NSLog(@"multipeer session: start timer");
  _restartTimer = [NSTimer scheduledTimerWithTimeInterval:30
                                                   target:self
                                                 selector:_restart
                                                 userInfo:nil
                                                  repeats:YES];
}

- (void)stopRestartTimer
{
  NSLog(@"multipeer session: stop timer");
  [_restartTimer invalidate];
}

- (void)stop
{
  NSLog(@"THEMultipeerSession stopping peer");

  [self stopRestartTimer];

  _delegate = nil;

  [_client stop];
  _client = nil;

  [_server stop];
  _server = nil;
    
  _peerID = nil;
}

- (void)restart
{
  NSLog(@"multipeer session: restart");
  [_server restart];
  [_client restart];
}

- (BOOL)connectToPeerServerWithPeerIdentifier:(NSString *)peerIdentifier
                          withConnectCallback:(void(^)(NSString *, uint))connectCallback
{
  // Connect to a previously discovered peer
  return [_client connectToPeerWithPeerIdentifier:peerIdentifier 
                              withConnectCallback:(void(^)(NSString *, uint))connectCallback];
}

- (BOOL)disconnectFromPeerServerWithPeerIdentifier:(NSString *)peerIdentifier
{
  // Disconnect from a previously (hopefully) connected peer
  return [_client disconnectFromPeerWithPeerIdentifier:peerIdentifier];
}

- (BOOL)killConnection:(NSString *)peerIdentifier
{
  // Cause trouble for testing purposes
  return [_client killConnection:peerIdentifier];
}

@end
