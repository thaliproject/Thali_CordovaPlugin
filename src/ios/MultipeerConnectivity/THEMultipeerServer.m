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
//  THEMultipeerServer.m

#import "THEMultipeerServer.h"
#import "THEMultipeerServerSession.h"
#import "THEMultipeerClientSession.h"

#import "THESessionDictionary.h"

static NSString * const PEER_IDENTIFIER_KEY  = @"PeerIdentifier";

@implementation THEMultipeerServer
{
    // Transport level id
    MCPeerID * _localPeerId;

    // The multipeer service advertiser
    MCNearbyServiceAdvertiser * _nearbyServiceAdvertiser;

    // Application level identifiers
    NSString *_localPeerIdentifier;
    NSString *_serviceType;

    // The port on which the application level is listening
    unsigned short _serverPort;

    // Map of sessions for all the peers we know about
    THESessionDictionary *_serverSessions;

    // Timer reset callback
    void (^_timerCallback)(void);
  
    // Object that will get to hear about peers we 'discover'
    id<THEMultipeerDiscoveryDelegate> _multipeerDiscoveryDelegate;
  
    // Object that can see server session states
    id<THEMultipeerSessionStateDelegate> _sessionStateDelegate;
  
    // Object that will hear about server completed connections
    id<THEMultipeerServerConnectionDelegate> _multipeerServerConnectionDelegate;
}

- (instancetype)initWithPeerID:(MCPeerID *)peerId
                       withPeerIdentifier:(NSString *)peerIdentifier
                          withServiceType:(NSString *)serviceType
                           withServerPort:(unsigned short)serverPort
           withMultipeerDiscoveryDelegate:(id<THEMultipeerDiscoveryDelegate>)multipeerDiscoveryDelegate
                 withSessionStateDelegate:(id<THEMultipeerSessionStateDelegate>)sessionStateDelegate
    withMultipeerServerConnectionDelegate:(id<THEMultipeerServerConnectionDelegate>)multipeerServerConnectionDelegate

{
    self = [super init];
    if (!self)
    {
        return nil;
    }

    // Init the basic multipeer server session
    _localPeerId = peerId;
    _localPeerIdentifier = peerIdentifier;
  
    _serviceType = serviceType;
    _serverPort = serverPort;

    _sessionStateDelegate = sessionStateDelegate;
    _multipeerDiscoveryDelegate = multipeerDiscoveryDelegate;
    _multipeerServerConnectionDelegate = multipeerServerConnectionDelegate;
  
    return self;
}

- (void)setTimerResetCallback:(void (^)(void))timerCallback
{
  _timerCallback = timerCallback;
}

- (void)start
{
  NSLog(@"server: starting %@", _localPeerIdentifier);

  _serverSessions = [[THESessionDictionary alloc] init];

  _nearbyServiceAdvertiser = [[MCNearbyServiceAdvertiser alloc] 
      initWithPeer:_localPeerId 
     discoveryInfo:@{ PEER_IDENTIFIER_KEY: _localPeerIdentifier }
       serviceType:_serviceType
  ];
  [_nearbyServiceAdvertiser setDelegate:self];

  [self startAdvertising];
}

- (void)startAdvertising
{
  // Start advertising our presence.. 
  [_nearbyServiceAdvertiser startAdvertisingPeer];
}

- (void)stop
{
  [_nearbyServiceAdvertiser setDelegate:nil];
  [self stopAdvertising];
  _nearbyServiceAdvertiser = nil;
  _serverSessions = nil;
}

- (void)stopAdvertising
{
  [_nearbyServiceAdvertiser stopAdvertisingPeer];
}

- (void)restart
{
  [self stopAdvertising];
  [self startAdvertising];
}

- (const THEMultipeerServerSession *)session:(NSString *)peerIdentifier
{
  __block THEMultipeerServerSession *session = nil;
  
  [_serverSessions updateForPeerIdentifier:peerIdentifier
                               updateBlock:^THEMultipeerPeerSession *(THEMultipeerPeerSession *p) {

    THEMultipeerServerSession *serverSession = (THEMultipeerServerSession *)p;
    if (serverSession)
    {
      session = serverSession;
    }

    return serverSession;
  }];
  
  return session;
}


// MCNearbyServiceAdvertiserDelegate
////////////////////////////////////

- (void)advertiser:(MCNearbyServiceAdvertiser *)advertiser
    didReceiveInvitationFromPeer:(MCPeerID *)peerID
                     withContext:(NSData *)context
               invitationHandler:(void (^)(BOOL accept, MCSession * session))invitationHandler
{
  __block THEMultipeerServerSession *_serverSession = nil;

  // Any invite at all will reset the timer (since an invite implies we're advertsing
  // correctly).
  if (_timerCallback)
    _timerCallback();

  // Crack the context into it's constiuent parts..
  NSString *stringContext = [[NSString alloc] initWithData:context encoding:NSUTF8StringEncoding];
  NSArray<NSString *> *contextParts = [stringContext componentsSeparatedByString:@"+"];
  if ([contextParts count] != 2)
  {
    NSLog(@"server: context did not parse");
    return;
  }

  NSString *remotePeerUUID = contextParts[0];
  NSString *localPeerIdentifier = contextParts[1];
  
  NSArray<NSString *> *localParts = [localPeerIdentifier componentsSeparatedByString:@":"];
  if ([localParts count] != 2)
  {
    NSLog(@"server: local id did not parse");
    return;
  }

  NSString *localPeerUUID = localParts[0];
  
  [_serverSessions updateForPeerID:peerID 
                       updateBlock:^THEMultipeerPeerSession *(THEMultipeerPeerSession *p) {

    THEMultipeerServerSession *serverSession = (THEMultipeerServerSession *)p;
    
    if (serverSession && ([[serverSession remotePeerID] hash] == [peerID hash]))
    {
      assert([remotePeerUUID compare:[serverSession remotePeerIdentifier]] == NSOrderedSame);
      
      // Disconnect any existing session, see note below
      NSLog(@"server: disconnecting to refresh session (%@)", [serverSession remotePeerIdentifier]);
      [serverSession disconnect];
    }
    else
    {
      serverSession = [[THEMultipeerServerSession alloc] initWithLocalPeerID:_localPeerId
                                                            withRemotePeerID:peerID
                                                    withRemotePeerIdentifier:remotePeerUUID
                                                              withServerPort:_serverPort];
    }

    _serverSession = serverSession;
    return serverSession;
  }];

  if ([_localPeerIdentifier compare:localPeerIdentifier] != NSOrderedSame)
  {
    // Remote is trying to connect to a previous generation of us, reject
    NSLog(
      @"server: rejecting invitation from %@ due to previous generation (%@ != %@)",
      remotePeerUUID, _localPeerIdentifier, localPeerIdentifier
    );
    invitationHandler(NO, [_serverSession session]);
  }
  else
  {
    if ([localPeerUUID compare:remotePeerUUID] == NSOrderedAscending)
    {
      NSLog(@"server: rejecting invitation for lexical ordering %@", remotePeerUUID);
      invitationHandler(NO, [_serverSession session]);
      [_multipeerDiscoveryDelegate didFindPeerIdentifier:remotePeerUUID byServer:true];
      return;
    }

    [_serverSession connectWithConnectCallback:^void(NSString *p, unsigned short c, unsigned short s) {
      [_multipeerServerConnectionDelegate serverDidCompleteConnection:p
                                                       withClientPort:c
                                                       withServerPort:s];
    }];

    NSLog(@"server: accepting invitation %@", remotePeerUUID);
    invitationHandler(YES, [_serverSession session]);
  }
}

- (void)advertiser:(MCNearbyServiceAdvertiser *)advertiser didNotStartAdvertisingPeer:(NSError *)error
{
    NSLog(@"WARNING: server didNotStartAdvertisingPeer");
}

@end
