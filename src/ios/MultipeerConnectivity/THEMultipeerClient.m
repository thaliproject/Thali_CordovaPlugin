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
#import "THEMultipeerServerSession.h"

#import "THESessionDictionary.h"

static NSString * const PEER_NAME_KEY        = @"PeerName";
static NSString * const PEER_IDENTIFIER_KEY  = @"PeerIdentifier";

@implementation THEMultipeerClient
{
  // Transport level identifier, we always init transport level
  // sessions (MCSessions) with this id and never the remote one
  MCPeerID * _localPeerId;

  // App-level peer identifier
  NSString * _localPeerIdentifier;

  // The multipeer browser
  MCNearbyServiceBrowser * _nearbyServiceBrowser;

  // Application level service info, the kind of service we're looking for
  NSString *_serviceType;

  // Delegate that will be informed when we discover a server
  id<THEMultipeerDiscoveryDelegate>  _multipeerDiscoveryDelegate;

  // Dict of all the servers ids we're current aware against their session states
  THESessionDictionary *_clientSessions;
  
  // Object that can see server session states..
  id<THEMultipeerSessionStateDelegate> _sessionStateDelegate;
  
  // Map of pending reverse connections (the connections we initiated
  // but will be completed by the remote connecting back to us)
  NSMutableDictionary *_pendingReverseConnections;
}

- (id)initWithPeerId:(MCPeerID *)peerId
                        withServiceType:(NSString *)serviceType
                     withPeerIdentifier:(NSString *)peerIdentifier
                    withSessionDelegate:(id<THEMultipeerSessionStateDelegate>)sessionDelegate
         withMultipeerDiscoveryDelegate:(id<THEMultipeerDiscoveryDelegate>)discoveryDelegate
{
  self = [super init];
  if (!self)
  {
      return nil;
  }

  // Init the basic multipeer client session

  _localPeerId = peerId;
  _serviceType = serviceType;
  _localPeerIdentifier = peerIdentifier;

  _sessionStateDelegate = sessionDelegate;
  _multipeerDiscoveryDelegate = discoveryDelegate;

  _pendingReverseConnections = [[NSMutableDictionary alloc] init];
  
  return self;
}

- (void)start
{
  // Start with a blank sheet of clients
  _clientSessions = [[THESessionDictionary alloc] init];

  _nearbyServiceBrowser = [[MCNearbyServiceBrowser alloc] 
                             initWithPeer:_localPeerId 
                              serviceType:_serviceType];
  [_nearbyServiceBrowser setDelegate:self];

  [self startBrowsing];
}

- (void)startBrowsing
{
  // Kick off the peer discovery process
  [_nearbyServiceBrowser startBrowsingForPeers];
}

- (void)stop
{
  [_nearbyServiceBrowser setDelegate:nil];
  [self stopBrowsing];
  _nearbyServiceBrowser = nil;
  _clientSessions = nil;
}

- (void)stopBrowsing
{
  [_nearbyServiceBrowser stopBrowsingForPeers];
}

- (void)restart
{
  [self stopBrowsing];
  [self startBrowsing];
}

- (void)callConnectCallback:(ConnectCallback)connectCallback
                           withListeningPort:(unsigned short)listeningPort
                              withClientPort:(unsigned short)clientPort
                              withServerPort:(unsigned short)serverPort
{
  NSMutableDictionary *connection = [[NSMutableDictionary alloc] initWithObjectsAndKeys:
    [NSNumber numberWithInteger:listeningPort], @"listeningPort",
    [NSNumber numberWithInteger:clientPort], @"clientPort",
    [NSNumber numberWithInteger:serverPort], @"serverPort",
    nil
  ];

  NSString *connectionJSON = [[NSString alloc] initWithData:
    [NSJSONSerialization dataWithJSONObject:connection options:0 error:nil]
    encoding:NSUTF8StringEncoding
  ];

  connectCallback(nil, connectionJSON);
}

- (BOOL)connectToPeerWithPeerIdentifier:(NSString *)peerIdentifier 
                    withConnectCallback:(ConnectCallback)connectCallback
{
  __block BOOL success = NO;
  __block THEMultipeerClientSession *clientSession = nil;

  if (_sessionStateDelegate)
  {
    // Check if there's a server session already
    const THEMultipeerServerSession *serverSession = [_sessionStateDelegate serverSession:peerIdentifier];
    
    if (serverSession && [serverSession connectionState] != THEPeerSessionStateConnected)
    {
      if ([serverSession connectionState] == THEPeerSessionStateConnected)
      {
        // We already have a remote-initiated session to this peer, return the details
        [self callConnectCallback:connectCallback withListeningPort:0
                                                     withClientPort:[serverSession clientPort]
                                                     withServerPort:[serverSession serverPort]];
        return YES;
      }
      else if ([serverSession connectionState] == THEPeerSessionStateConnecting)
      {
        // We're in the process of accepting a connection from the remote peer, have them call us
        // back when it's completed
        [serverSession addConnectCallback:^void(unsigned short clientPort, unsigned short serverPort) {
          [self callConnectCallback:connectCallback withListeningPort:0
                                                       withClientPort:clientPort
                                                       withServerPort:serverPort];
        }];
        return YES;
      }
    }
  }
  
  [_clientSessions updateForPeerIdentifier:peerIdentifier 
                               updateBlock:^THEMultipeerPeerSession *(THEMultipeerPeerSession *p) {

    clientSession = (THEMultipeerClientSession *)p;
    if (clientSession)
    {
      if (![clientSession visible])
      {
        success = NO;
        NSLog( @"client: connect: unreachable %@", peerIdentifier);
        connectCallback(@"Peer unreachable", 0);
      }
      else
      {
        // Start connection process from the top if no existing connection
        if ([clientSession connectionState] == THEPeerSessionStateNotConnected)
        {
          if ([_localPeerIdentifier compare:peerIdentifier] == NSOrderedAscending)
          {
            // connect will create the networking resources required to establish the session
            [clientSession connectWithConnectCallback:(ConnectCallback)connectCallback];
          }
          else
          {
            @synchronized(_pendingReverseConnections)
            {
              _pendingReverseConnections[peerIdentifier] = connectCallback;
            }
            [clientSession connect];
          }
          
          [_nearbyServiceBrowser invitePeer:[clientSession remotePeerID]
                                  toSession:[clientSession session]
                                withContext:
                                  [_localPeerIdentifier dataUsingEncoding:NSUTF8StringEncoding]
                                    timeout:30];

          success = YES;
        }
        else
        {
          NSLog(@"client: already connect(ing/ed) to %@", peerIdentifier);
          connectCallback(@"Aleady connecting", 0);
          success = NO;
        }
      }
    }
      
    return clientSession;
  }];

  if (!clientSession)
  {
    NSLog(@"client: unknown peer %@", peerIdentifier);
    connectCallback(@"Unknown peer", 0);
  }

  return success;
}

- (BOOL)killConnection:(NSString *)peerIdentifier
{
  __block BOOL success = NO;

  [_clientSessions updateForPeerIdentifier:peerIdentifier 
                               updateBlock:^THEMultipeerPeerSession *(THEMultipeerPeerSession *p) {

    THEMultipeerClientSession *clientSession = (THEMultipeerClientSession *)p;
    if (clientSession)
    {
      if ([clientSession connectionState] != THEPeerSessionStateConnected)
      {
        success = YES;

        NSLog(@"client: killing peer: %@", peerIdentifier);
        [clientSession kill];
      }
    }

    return clientSession;
  }];

  return success;
}

- (void)didAcceptIncomingConnectionFromPeerIdentifier:(NSString *)peerIdentifier
{
  // Server component has just accepted an incoming connection.. this may be a reverse
  // connect that we initiated.
  
  /*@synchronized(_pendingReverseConnections)
  {
    ConnectCallback connectCallback = [_pendingReverseConnections objectForKey:peerIdentifier];
    if (connectCallback != nil)
    {
      if (_sessionStateDelegate)
      {
        THEMultipeerServerSession *serverSession =
        (THEMultipeerServerSession *)[_serverSessionStateDelegate session:peerIdentifier];
        
        assert(serverSession);
        
        [self callConnectCallback:connectCallback withListeningPort:0
                   withClientPort:[serverSession clientPort]
                   withServerPort:[serverSession serverPort]];
      }
    }
    [_pendingReverseConnections removeObjectForKey:peerIdentifier];
  }*/
}

// THEMultipeerSessionStateDelegate
///////////////////////////////////

- (const THEMultipeerClientSession *)session:(NSString *)peerIdentifier
{
  // Let external component peek at our session states
  
  __block THEMultipeerClientSession *session = nil;
  
  [_clientSessions updateForPeerIdentifier:peerIdentifier
                               updateBlock:^THEMultipeerPeerSession *(THEMultipeerPeerSession *p) {

    THEMultipeerClientSession *clientSession = (THEMultipeerClientSession *)p;
    if (clientSession)
    {
      session = clientSession;
    }

    return clientSession;
  }];
  
  return session;
}

// MCNearbyServiceBrowserDelegate
/////////////////////////////////

- (void)browser:(MCNearbyServiceBrowser *)browser foundPeer:(MCPeerID *)peerID 
                                          withDiscoveryInfo:(NSDictionary *)info
{
  __block BOOL previouslyVisible = NO;
  __block THEMultipeerClientSession *clientSession = nil;

  // Find or create an app session for this peer..
  [_clientSessions updateForPeerID:peerID 
                       updateBlock:^THEMultipeerPeerSession *(THEMultipeerPeerSession *p) {

    THEMultipeerClientSession *session = (THEMultipeerClientSession *)p;

    NSString *peerIdentifier = info[PEER_IDENTIFIER_KEY];
    if (session && ([[session remotePeerID] hash] == [peerID hash]) && 
        [peerIdentifier isEqualToString:[session remotePeerIdentifier]])
    {
      clientSession = session;
      previouslyVisible = clientSession.visible;
    }
    else
    {
      // We've found a new peer, create a new record
      clientSession = [[THEMultipeerClientSession alloc] 
                                    initWithLocalPeerID:_localPeerId 
                                       withRemotePeerID:peerID 
                               withRemotePeerIdentifier:peerIdentifier];
    }

    NSLog(@"client: found peer: %@", [clientSession remotePeerIdentifier]);
    [clientSession setVisible:YES];
    return clientSession;
  }];

  if (clientSession && previouslyVisible == NO)
  {
    // A new peer or one that has become visible again. Only
    // contact delegate when the state changes (we get duplicates a lot)
    [_multipeerDiscoveryDelegate didFindPeerIdentifier:[clientSession remotePeerIdentifier] byServer:false];
  }
}

// Notifies the delegate that a peer was lost.
- (void)browser:(MCNearbyServiceBrowser *)browser
       lostPeer:(MCPeerID *)peerID
{
  __block BOOL previouslyVisible = NO;
  __block THEMultipeerClientSession *clientSession = nil;

  // Update the peer's record under lock
  [_clientSessions updateForPeerID:peerID
                       updateBlock:^THEMultipeerPeerSession *(THEMultipeerPeerSession *p) {

    clientSession = (THEMultipeerClientSession *)p;
    assert([[clientSession remotePeerID] hash] == [peerID hash]);
    NSLog(@"client: lost peer: %@", [clientSession remotePeerIdentifier]);

    previouslyVisible = clientSession.visible;
    [clientSession onPeerLost];

    return clientSession;
  }];
    
  if (clientSession)
  {
    if (previouslyVisible == YES)
    {
      // Let interested parties know we lost a peer, only do this on a state change
      [_multipeerDiscoveryDelegate didLosePeerIdentifier:[clientSession remotePeerIdentifier]];
    }
  }
  else
  {
    // This'll happen on wifi
    NSLog(@"Unknown peer");
  }
}

- (void)browser:(MCNearbyServiceBrowser *)browser didNotStartBrowsingForPeers:(NSError *)error
{
  NSLog(@"WARNING: didNotStartBrowsingForPeers");
}

@end
