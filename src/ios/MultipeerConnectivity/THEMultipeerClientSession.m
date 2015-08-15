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
  // The transport level peer id
  MCPeerID *_remotePeerID;
  
  // The applications level peer id
  NSString *_remotePeerIdentifier;

  // Callback to fire when a connection completes (in fact when the relay
  // has established it's listening socket)
  ConnectCallback _connectCallback;
}

- (instancetype)initWithLocalPeerID:(MCPeerID *)localPeerID
                   withRemotePeerID:(MCPeerID *)remotePeerID
           withRemotePeerIdentifier:(NSString *)remotePeerIdentifier
{
  self = [super initWithPeerID:localPeerID withSessionType:@"client"];
  if (!self)
  {
      return nil;
  }

  _remotePeerID = remotePeerID;
  _remotePeerIdentifier = remotePeerIdentifier;

  return self;
}

-(MCPeerID *)peerID
{
  return _remotePeerID;
}

-(NSString *)peerIdentifier
{
  return _remotePeerIdentifier;
}

- (MCSession *)connectWithConnectCallback:(ConnectCallback)connectCallback
{
  assert(_connectCallback == nil);

  MCSession *mcSession = [super connect];
  if (mcSession)
  {
    _connectCallback = connectCallback;
  }

  return mcSession;
}

- (void)disconnect
{
  THEPeerSessionState prevState = [self connectionState];

  [super disconnect];
  if (_connectCallback != nil)
  {
    if (prevState == THEPeerSessionStateConnecting)
    {
      _connectCallback(@"Session disconnected", 0);
    }
    _connectCallback = nil;
  }
}

- (THEMultipeerSocketRelay *)createRelay
{
  THEMultipeerClientSocketRelay *clientRelay = [
    [THEMultipeerClientSocketRelay alloc] initWithPeerIdentifier:_remotePeerIdentifier
  ];
  // We'll call this delegate back when a listening socket is established
  // to which the application client will connect to be bridged to the remote server
  [clientRelay setDelegate:(id<THEMultipeerClientSocketRelayDelegate>) self];

  return clientRelay;
}

- (void)didListenWithLocalPort:(uint)port withPeerIdentifier:(NSString*)peerIdentifier
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

- (void)didNotListenWithErrorMessage:(NSString *)errorMsg 
                  withPeerIdentifier:(NSString*)peerIdentifier
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

@end


