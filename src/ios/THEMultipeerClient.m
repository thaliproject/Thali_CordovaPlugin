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
#import "THEPeerServerSession.h"
#import "THEProtectedMutableDictionary.h"

static NSString * const PEER_NAME_KEY        = @"PeerName";
static NSString * const PEER_IDENTIFIER_KEY  = @"PeerIdentifier";

static const uint MAX_CONNECT_RETRIES = 5;

@interface MultipeerClient()
  - (BOOL)tryInviteToSessionWithPeerSession:(THEPeerSession *)peerSession;
@end

@implementation MultipeerClient
{
  // Transport level identifier, we always init transport level
  // sessions with this id and never the remote one
  MCPeerID * _localPeerId;

  // The multipeer browser
  MCNearbyServiceBrowser * _nearbyServiceBrowser;

  // Application level service info, the kind of service we're looking for
  NSString *_serviceType;

  // Delegate that will be informed when we discover a server
  id<THEPeerNetworkingDelegate>  _peerNetworkingDelegate;

  // Map servers we're currenty connecting to against the callbacks
  // we should call when that connection completes
  THEProtectedMutableDictionary *_servers;
}

- (id)initWithPeerId:(MCPeerID *)peerId 
                        withServiceType:(NSString *)serviceType 
             withPeerNetworkingDelegate:(id<THEPeerNetworkingDelegate>)peerNetworkingDelegate
{
  self = [super init];
  if (!self)
  {
      return nil;
  }

  // Init the basic multipeer client session

  _localPeerId = peerId;
  _serviceType = serviceType;

  _peerNetworkingDelegate = peerNetworkingDelegate;

  return self;
}

- (void)start
{
  NSLog(@"client starting");

  _servers = [[THEProtectedMutableDictionary alloc] init];

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

  _servers = nil;
}

- (BOOL)connectToPeerWithPeerIdentifier:(NSString *)peerIdentifier
{
  __block BOOL success = NO;

  BOOL (^filterBlock)(NSObject *peer) = ^BOOL(NSObject *v) {
    // Search for the peer with matching peerIdentifier
    THEPeerServerSession *serverSession = 
        (THEPeerServerSession *)([v isKindOfClass:[THEPeerServerSession class]] ? v : Nil);
    return serverSession && [[serverSession peerIdentifier] isEqualToString:peerIdentifier];
  };

  [_servers updateWithFilter:filterBlock updateBlock:^BOOL(NSObject *v) {

    // Called only when v == matching peer
    THEPeerServerSession *serverSession = (THEPeerServerSession *)v;

    // Start connection process from the top
    if ([serverSession connectionState] == THEPeerSessionStateNotConnected)
    {
      // connect will create the networking resources required to establish the session
      [serverSession connect];

      NSLog(@"client: inviting peer");
      [_nearbyServiceBrowser invitePeer:[serverSession peerID]
                              toSession:[serverSession session]
                            withContext:nil
                                timeout:60];

      success = YES;
    }
    else
    {
      NSLog(@"client: already connect(ing/ed)");
      success = NO;
    }

    // Stop iterating
    return NO;
  }];

  return success;
}

- (BOOL)disconnectFromPeerWithPeerIdentifier:(NSString *)peerIdentifier
{
  __block BOOL success = NO;

  BOOL (^filterBlock)(NSObject *peer) = ^BOOL(NSObject *v) {
    // Search for the peer with matching peerIdentifier
    THEPeerServerSession *serverSession = 
        (THEPeerServerSession *)([v isKindOfClass:[THEPeerServerSession class]] ? v : Nil);
    return serverSession && [serverSession.peerIdentifier isEqualToString:peerIdentifier];
  };

  [_servers updateWithFilter:filterBlock updateBlock:^BOOL(NSObject *v) {

    // Called only when v == matching peer
    THEPeerServerSession *serverSession = (THEPeerServerSession *)v;
    if ([serverSession connectionState] != THEPeerSessionStateNotConnected)
    {
      success = YES;
      [serverSession setConnectionState:THEPeerSessionStateNotConnected];

      NSLog(@"client: disconnecting peer: %@", peerIdentifier);
      [serverSession disconnect];
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
  __block THEPeerServerSession *serverSession = nil;

  // Find or create an app session for this peer..
  [_servers createWithKey:peerID createBlock: ^NSObject *(NSObject *oldValue) {

    THEPeerServerSession *descriptor = (THEPeerServerSession *)oldValue;

    if (descriptor && ([descriptor.peerID hash] == [peerID hash]))
    {
      NSLog(@"client: Found existing peer: %@", info[PEER_IDENTIFIER_KEY]);

      serverSession = descriptor;
            
      // Returning nil to indicate we don't need to replace the existing record
      return nil;
    }

    NSLog(@"client: Found new peer: %@", info[PEER_IDENTIFIER_KEY]);

    // We've found a new peer, create a new record
    serverSession = [[THEPeerServerSession alloc] 
        initWithLocalPeerID:_localPeerId 
           withRemotePeerID:peerID 
   withRemotePeerIdentifier:info[PEER_IDENTIFIER_KEY]];

    // Return the new descriptor to be stored
    return serverSession;
  }];

  if (serverSession)
  {
    [serverSession setVisible:YES];

    // A new peer or one that has become visible again
    if ([_peerNetworkingDelegate respondsToSelector:@selector(didFindPeerIdentifier:peerName:)])
    {
      [_peerNetworkingDelegate 
        didFindPeerIdentifier:[serverSession peerIdentifier] 
                     peerName:info[PEER_NAME_KEY]];
    }
  }
}

// Notifies the delegate that a peer was lost.
- (void)browser:(MCNearbyServiceBrowser *)browser
       lostPeer:(MCPeerID *)peerID
{
  __block THEPeerServerSession *serverSession = nil;

  // Update the peer's record under lock
  [_servers updateWithKey:peerID updateBlock: ^void(NSObject *v) {

    serverSession = 
      (THEPeerServerSession *)([v isKindOfClass:[THEPeerServerSession class]] ? v : Nil);

    if (serverSession)
    {
      // disconnect will clear up any networking resources we currently hold
      [serverSession disconnect];
      [serverSession setVisible:NO];
      NSLog(@"client: Lost peer: %@", [serverSession peerIdentifier]);
    }
  }];
    
  if (serverSession)
  {
    // Let interested parties know we lost a peer
    if ([_peerNetworkingDelegate respondsToSelector:@selector(didLosePeerIdentifier:)])
    {
      [_peerNetworkingDelegate didLosePeerIdentifier:[serverSession peerIdentifier]];
    }
  }
  else
  {
    // Shouldn't happen
    NSLog(@"WARNING: lostPeer we didn't know about");
  }
}

- (void)browser:(MCNearbyServiceBrowser *)browser didNotStartBrowsingForPeers:(NSError *)error
{
  NSLog(@"WARNING: didNotStartBrowsingForPeers");
}


@end
