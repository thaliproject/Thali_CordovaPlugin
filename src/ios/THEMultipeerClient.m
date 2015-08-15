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
#import "THEPeerClientSession.h"
#import "THEProtectedMutableDictionary.h"

static NSString * const PEER_NAME_KEY        = @"PeerName";
static NSString * const PEER_IDENTIFIER_KEY  = @"PeerIdentifier";

@implementation MultipeerClient
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

  // Map servers we're currenty connecting to against the callbacks
  // we should call when that connection completes
  THEProtectedMutableDictionary *_servers;
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
    THEPeerClientSession *clientSession = 
        (THEPeerClientSession *)([v isKindOfClass:[THEPeerClientSession class]] ? v : Nil);
    return clientSession && [[clientSession peerIdentifier] isEqualToString:peerIdentifier];
  };

  [_servers updateWithFilter:filterBlock updateBlock:^BOOL(NSObject *v) {

    // Called only when v == matching peer
    THEPeerClientSession *clientSession = (THEPeerClientSession *)v;

    // Start connection process from the top
    if ([clientSession connectionState] == THEPeerSessionStateNotConnected)
    {
      // connect will create the networking resources required to establish the session
      [clientSession connect];

      NSLog(@"client: inviting peer");
      [_nearbyServiceBrowser invitePeer:[clientSession peerID]
                              toSession:[clientSession session]
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
    THEPeerClientSession *clientSession = 
        (THEPeerClientSession *)([v isKindOfClass:[THEPeerClientSession class]] ? v : Nil);
    return clientSession && [clientSession.peerIdentifier isEqualToString:peerIdentifier];
  };

  [_servers updateWithFilter:filterBlock updateBlock:^BOOL(NSObject *v) {

    // Called only when v == matching peer
    THEPeerClientSession *clientSession = (THEPeerClientSession *)v;
    if ([clientSession connectionState] != THEPeerSessionStateNotConnected)
    {
      success = YES;
      [clientSession setConnectionState:THEPeerSessionStateNotConnected];

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
  __block THEPeerClientSession *clientSession = nil;

  // Find or create an app session for this peer..
  [_servers createWithKey:peerID createBlock: ^NSObject *(NSObject *oldValue) {

    THEPeerClientSession *descriptor = (THEPeerClientSession *)oldValue;

    if (descriptor && ([descriptor.peerID hash] == [peerID hash]))
    {
      NSLog(@"client: Found existing peer: %@", info[PEER_IDENTIFIER_KEY]);

      clientSession = descriptor;
            
      // Returning nil to indicate we don't need to replace the existing record
      return nil;
    }

    NSLog(@"client: Found new peer: %@", info[PEER_IDENTIFIER_KEY]);

    // We've found a new peer, create a new record
    clientSession = [[THEPeerClientSession alloc] 
        initWithLocalPeerID:_localPeerId 
           withRemotePeerID:peerID 
   withRemotePeerIdentifier:info[PEER_IDENTIFIER_KEY]];

    // Return the new descriptor to be stored
    return clientSession;
  }];

  if (clientSession)
  {
    [clientSession setVisible:YES];

    // A new peer or one that has become visible again
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
  __block THEPeerClientSession *clientSession = nil;

  // Update the peer's record under lock
  [_servers updateWithKey:peerID updateBlock: ^void(NSObject *v) {

    clientSession = 
      (THEPeerClientSession *)([v isKindOfClass:[THEPeerClientSession class]] ? v : Nil);

    if (clientSession)
    {
      // disconnect will clear up any networking resources we currently hold
      [clientSession disconnect];
      [clientSession setVisible:NO];
      NSLog(@"client: Lost peer: %@", [clientSession peerIdentifier]);
    }
  }];
    
  if (clientSession)
  {
    // Let interested parties know we lost a peer
    if ([_multipeerSessionDelegate respondsToSelector:@selector(didLosePeerIdentifier:)])
    {
      [_multipeerSessionDelegate didLosePeerIdentifier:[clientSession peerIdentifier]];
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
