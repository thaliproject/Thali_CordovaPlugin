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
//  THEMultipeerClient.m

#import "THEMultipeerClient.h"
#import "THEMultipeerClientSession.h"
#import "THEProtectedMutableDictionary.h"

static NSString * const PEER_NAME_KEY        = @"PeerName";
static NSString * const PEER_IDENTIFIER_KEY  = @"PeerIdentifier";

@implementation THEMultipeerClient
{
  // Transport level identifier, we always init transport level
  // sessions (MCSessions) with this id and never the remote one
  MCPeerID * _localPeerId;

  // The multipeer browser
  MCNearbyServiceBrowser * _nearbyServiceBrowser;

  // Application level service info, the kind of service we're looking for
  NSString *_serviceType;

  // Delegate that will be informed when we discover a server
  id<THEMultipeerSessionDelegate>  _multipeerSessionDelegate;

  // Dict of all the servers ids we're current aware against their session states
  THEProtectedMutableDictionary *_clientSessions;
}

- (id)initWithPeerId:(MCPeerID *)peerId 
                        withServiceType:(NSString *)serviceType 
             withPeerNetworkingDelegate:(id<THEMultipeerSessionDelegate>)multipeerSessionDelegate
{
  self = [super init];
  if (!self)
  {
      return nil;
  }

  // Init the basic multipeer client session

  _localPeerId = peerId;
  _serviceType = serviceType;

  _multipeerSessionDelegate = multipeerSessionDelegate;

  return self;
}

- (void)start
{
  NSLog(@"client starting");

  _clientSessions = [[THEProtectedMutableDictionary alloc] init];

  // Kick off the peer discovery process
  _nearbyServiceBrowser = [[MCNearbyServiceBrowser alloc] 
                             initWithPeer:_localPeerId 
                              serviceType:_serviceType];
  [_nearbyServiceBrowser setDelegate:self];
  [_nearbyServiceBrowser startBrowsingForPeers];
}

- (void)stop
{
  NSLog(@"client: stopping");

  [_nearbyServiceBrowser stopBrowsingForPeers];
  _nearbyServiceBrowser = nil;

  _clientSessions = nil;
}

- (BOOL)connectToPeerWithPeerIdentifier:(NSString *)peerIdentifier 
                    withConnectCallback:(ConnectCallback)connectCallback
{
  __block BOOL success = NO;
  __block THEMultipeerClientSession *clientSession = nil;

  NSLog(@"connectToPeer %@", peerIdentifier);

  BOOL (^filterBlock)(NSObject *peer) = ^BOOL(NSObject *v) {
    // Search for the peer with matching peerIdentifier
    THEMultipeerClientSession *clientSession = 
      (THEMultipeerClientSession *)([v isKindOfClass:[THEMultipeerClientSession class]] ? v : Nil);
    return clientSession && [[clientSession peerIdentifier] isEqualToString:peerIdentifier];
  };
  
  [_clientSessions updateWithFilter:filterBlock updateBlock:^BOOL(NSObject *v) {

    clientSession = (THEMultipeerClientSession *)v;

    if (![clientSession visible])
    {
      success = NO;
      NSLog(@"Peer unreachable %@", peerIdentifier);
      connectCallback(@"Peer unreachable", 0);
    }
    else
    {
      // Start connection process from the top
      if ([clientSession connectionState] == THEPeerSessionStateNotConnected)
      {

        // connect will create the networking resources required to establish the session
        [clientSession connectWithConnectCallback:(ConnectCallback)connectCallback];

        NSLog(@"client: inviting peer %@", peerIdentifier);
        [_nearbyServiceBrowser invitePeer:[clientSession peerID]
                                toSession:[clientSession session]
                              withContext:[peerIdentifier dataUsingEncoding:NSUTF8StringEncoding]
                                  timeout:60];

        success = YES;
      }
      else
      {
        NSLog(@"client: already connect(ing/ed) to %@", peerIdentifier);
        connectCallback(@"Aleady connecting", 0);
        success = NO;
      }
    }

    // Stop iterating
    return NO;
  }];

  if (!clientSession)
  {
    NSLog(@"Unknown peer %@", peerIdentifier);
    connectCallback(@"Unknown peer", 0);
  }

  return success;
}

- (BOOL)disconnectFromPeerWithPeerIdentifier:(NSString *)peerIdentifier
{
  __block BOOL success = NO;

  BOOL (^filterBlock)(NSObject *peer) = ^BOOL(NSObject *v) {
    // Search for the peer with matching peerIdentifier
    THEMultipeerClientSession *clientSession = 
       (THEMultipeerClientSession *)([v isKindOfClass:[THEMultipeerClientSession class]] ? v : Nil);
    return clientSession && [clientSession.peerIdentifier isEqualToString:peerIdentifier];
  };

  [_clientSessions updateWithFilter:filterBlock updateBlock:^BOOL(NSObject *v) {

    THEMultipeerClientSession *clientSession = (THEMultipeerClientSession *)v;
    if ([clientSession connectionState] != THEPeerSessionStateNotConnected)
    {
      success = YES;

      NSLog(@"client: disconnecting peer: %@", peerIdentifier);
      [clientSession disconnect];
    }

    // Stop iterating
    return NO;
  }];
    
  return success; 
}

// MCNearbyServiceBrowserDelegate
/////////////////////////////////

- (void)browser:(MCNearbyServiceBrowser *)browser foundPeer:(MCPeerID *)peerID withDiscoveryInfo:(NSDictionary *)info
{
  __block BOOL previouslyVisible = NO;
  __block THEMultipeerClientSession *clientSession = nil;

  // Find or create an app session for this peer..
  [_clientSessions createWithKey:peerID createBlock: ^NSObject *(NSObject *oldValue) {

    NSString *peerIdentifier = info[PEER_IDENTIFIER_KEY];
    THEMultipeerClientSession *session = (THEMultipeerClientSession *)oldValue;

    if (session && ([session.peerID hash] == [peerID hash]) && 
        [peerIdentifier isEqualToString:[session peerIdentifier]])
    {
      NSLog(@"client: Found existing peer: %@", peerIdentifier);

      clientSession = session;
      previouslyVisible = clientSession.visible;
    }
    else
    {
      NSLog(@"client: Found new peer: %@", peerIdentifier);

      // We've found a new peer, create a new record
      clientSession = [[THEMultipeerClientSession alloc] 
                                    initWithLocalPeerID:_localPeerId 
                                       withRemotePeerID:peerID 
                                     withPeerIdentifier:peerIdentifier];
    }

    [clientSession setVisible:YES];
    return clientSession;
  }];

  if (clientSession && previouslyVisible == NO)
  {
    // A new peer or one that has become visible again. Only
    // contact delegate when the state changes (we get duplicates a lot)
    if ([_multipeerSessionDelegate respondsToSelector:@selector(didFindPeerIdentifier:peerName:)])
    {
      [_multipeerSessionDelegate 
        didFindPeerIdentifier:[clientSession peerIdentifier] 
                     peerName:info[PEER_NAME_KEY]];
    }
  }
}

// Notifies the delegate that a peer was lost.
- (void)browser:(MCNearbyServiceBrowser *)browser
       lostPeer:(MCPeerID *)peerID
{
  __block BOOL previouslyVisible = NO;
  __block THEMultipeerClientSession *clientSession = nil;

  // Update the peer's record under lock
  [_clientSessions updateWithKey:peerID updateBlock: ^void(NSObject *v) {

    clientSession = 
      (THEMultipeerClientSession *)([v isKindOfClass:[THEMultipeerClientSession class]] ? v : Nil);

    previouslyVisible = clientSession.visible;

    if (clientSession)
    {
      NSLog(@"client: lost peer: %@", [clientSession peerIdentifier]);
      // disconnect will clear up any networking resources we currently hold
      [clientSession disconnect];
      [clientSession setVisible:NO];
    }
  }];
    
  if (clientSession)
  {
    if (previouslyVisible == YES)
    {
      // Let interested parties know we lost a peer, only do this on a state change
      if ([_multipeerSessionDelegate respondsToSelector:@selector(didLosePeerIdentifier:)])
      {
        [_multipeerSessionDelegate didLosePeerIdentifier:[clientSession peerIdentifier]];
      }
    }
  }
  else
  {
    // Probably shouldn't happen
    NSLog(@"WARNING: lostPeer we didn't know about");
  }
}

- (void)browser:(MCNearbyServiceBrowser *)browser didNotStartBrowsingForPeers:(NSError *)error
{
  NSLog(@"WARNING: didNotStartBrowsingForPeers");
}


@end
