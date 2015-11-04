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

#include "jx.h"
#import "JXcore.h"
#import "THEThreading.h"

@implementation THEMultipeerClientSession
{
  // Callback to fire when a connection completes (in fact when the relay
  // has established it's listening socket)
  ConnectCallback _connectCallback;
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

- (void)connectWithConnectCallback:(ConnectCallback)connectCallback
{
  @synchronized(self)
  {
    assert(_connectCallback == nil);

    [super connect];
    _connectCallback = connectCallback;
  }
}

- (void)disconnect
{
  @synchronized(self)
  {
    THEPeerSessionState prevState = [self connectionState];

    [super disconnect];
    if (_connectCallback != nil)
    {
      if (prevState == THEPeerSessionStateConnecting)
      {
        NSLog(@"client session: disconnected: %@", [self remotePeerIdentifier]);
        _connectCallback(@"Peer disconnected", 0);
      }
      _connectCallback = nil;
    }
  }
}

- (THEMultipeerSocketRelay *)newSocketRelay
{
  return [[THEMultipeerClientSocketRelay alloc] initWithPeerIdentifier:[self remotePeerIdentifier] 
                                                    withDelegate:self];
}

- (void)didListenWithLocalPort:(uint)port withPeerIdentifier:(NSString*)peerIdentifier
{
  @synchronized(self)
  {
    if (_connectCallback)
    {
      _connectCallback(nil, port);
      _connectCallback = nil;
    }
    else
    {
      NSLog(@"WARNING: didListenWithLocalPort but no callback");
    }
  }
}

- (void)didNotListenWithErrorMessage:(NSString *)errorMsg 
                  withPeerIdentifier:(NSString*)peerIdentifier
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

- (void)didDisconnectFromPeer:(NSString *)peerIdentifier
{
  NSString * const kPeerConnectionError   = @"connectionError";
  NSString * const kEventValueStringPeerId = @"peerIdentifier";

  // Socket disconnecting currently requires we tear down the entire p2p conection
  NSLog(@"client session: disconnecting due to socket close: %@", [self remotePeerIdentifier]);
  [self disconnect];

  NSDictionary *connectionError = @{
    kEventValueStringPeerId : peerIdentifier
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

@end
