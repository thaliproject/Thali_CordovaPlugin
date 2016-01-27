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
//  THEMultipeerClientSession.m
//

#import "THEAppContext.h"
#import "THEMultipeerClientSession.h"
#import "THEMultipeerClientSocketRelay.h"

@implementation THEMultipeerClientSession
{
  // Callback to fire when a connection completes (in fact when the relay
  // has established it's listening socket)
  ClientConnectCallback _connectCallback;
}

- (instancetype)initWithLocalPeerID:(MCPeerID *)localPeerID
                   withRemotePeerID:(MCPeerID *)remotePeerID
           withRemotePeerIdentifier:(NSString *)remotePeerIdentifier
{
  self = [super initWithLocalPeerID:localPeerID 
                   withRemotePeerID:remotePeerID
           withRemotePeerIdentifier:remotePeerIdentifier 
                    withSessionType:@"client"];
  if (!self)
  {
      return nil;
  }

  return self;
}

- (void)connectWithConnectCallback:(ClientConnectCallback)connectCallback
{
  @synchronized(self)
  {
    assert(_connectCallback == nil);

    _connectCallback = connectCallback;
    [super connect];
  }
}


- (void)fireConnectCallback:(NSString *)error withPort:(uint)port
{
  @synchronized(self)
  {
    if (!_connectCallback)
    {
      NSLog(@"client session: no connect callabck (server initiated)");
      return;
    }
    
    NSLog(@"client session: fireConnectCallback: %@", [self remotePeerUUID]);

    assert(_connectCallback != nil);

    NSMutableDictionary *connection = nil;
    if (!error)
    {
      connection = [[NSMutableDictionary alloc] initWithObjectsAndKeys:
        [NSNumber numberWithInteger:port], @"listeningPort",
        [NSNumber numberWithInteger:0], @"clientPort",
        [NSNumber numberWithInteger:0], @"serverPort",
        nil
      ];
    }

    _connectCallback(error, connection);
    _connectCallback = nil;
  }
}

/*
- (void)fireConnectionErrorEvent
{
  NSLog(@"client session: fireConnectionErrorEvent: %@", [self remotePeerIdentifier]);

  NSString * const kPeerConnectionError   = @"connectionError";
  NSString * const kEventValueStringPeerId = @"peerIdentifier";

  NSDictionary *connectionError = @{
    kEventValueStringPeerId : [self remotePeerIdentifier]
  };

  NSError *error = nil;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:connectionError
                                                      options:NSJSONWritingPrettyPrinted 
                                                        error:&error];
  if (error != nil) {
    // Will never happen in practice
    NSLog(@"WARNING: Could not generate jsonString for disconnect message");
    return;
  }

  NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];

  OnMainThread(^{
    [JXcore callEventCallback:kPeerConnectionError withJSON:jsonString];
  });
}
*/

- (THEMultipeerSocketRelay *)newSocketRelay
{
  return [[THEMultipeerClientSocketRelay alloc] initWithPeerIdentifier:[self remotePeerUUID]
                                                    withDelegate:self];
}

// The p2p socket or iostream has failed
- (void)onLinkFailure
{
  @synchronized(self)
  {
    NSLog(@"client session: onLinkFailure: %@", [self remotePeerUUID]);

    assert([self connectionState] != THEPeerSessionStateNotConnected);

    THEPeerSessionState prevState = [self connectionState];
    [self disconnect];

    if (prevState == THEPeerSessionStateConnecting)
      [self fireConnectCallback:@"Peer disconnected" withPort:0];
    /*
    else if (prevState == THEPeerSessionStateConnected)
      [self fireConnectionErrorEvent];
    {
      NSLog(@"client session: Unexpected state (disconnected) in onLinkFailure");
      [NSException raise:@"Unexpected state" 
        format:@"state %lu was unexpected in onLinkFailure", (unsigned long)[self connectionState]];
    }*/
  }
}

// Lost the peer
- (void)onPeerLost
{
  @synchronized(self)
  {
    NSLog(@"client session: onPeerLost: %@", [self remotePeerUUID]);
    // Losing peers is independent of losing the link so
    // we may already be disconnected
    if ([self connectionState] != THEPeerSessionStateNotConnected)
      [self onLinkFailure];
    [self setVisible:NO]; 
  }
}

// User-initiated disconnect
/*- (void)disconnectFromPeer
{
  @synchronized(self)
  {
    NSLog(@"client session: disconnectFromPeer: %@", [self remotePeerIdentifier]);

    assert([self connectionState] != THEPeerSessionStateNotConnected);

    THEPeerSessionState prevState = [self connectionState];
    [self disconnect];

    if (prevState == THEPeerSessionStateConnecting && _connectCallback != nil)
      [self fireConnectCallback:@"Peer disconnected" withPort:0];
  }
}*/


// ClientSocketRelayDelegate methods
/////////////////////////////////////

- (void)didListenWithLocalPort:(uint)port
{
  @synchronized(self)
  {
    [self fireConnectCallback:nil withPort:port];
  }
}

- (void)didNotListenWithErrorMessage:(NSString *)errorMsg 
{
  @synchronized(self)
  {
    if (_connectCallback)
    {
      _connectCallback(errorMsg, 0);
      _connectCallback = nil;
    }
    else
    {
      NSLog(@"WARNING: didNotListenWithLocalPort but no callback");
    }
  }
}
  
- (void)didDisconnectFromPeer
{
  // The p2p socket has been closed
  NSLog(@"client session: socket closed: %@", [self remotePeerUUID]);
  [self onLinkFailure];
}

@end
