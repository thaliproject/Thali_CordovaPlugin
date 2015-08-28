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

#import "THESessionDictionary.h"

static NSString * const PEER_IDENTIFIER_KEY  = @"PeerIdentifier";

@implementation THEMultipeerServer
{
    // Transport level id
    MCPeerID * _localPeerId;

    // The multipeer service advertiser
    MCNearbyServiceAdvertiser * _nearbyServiceAdvertiser;

    // Application level identifiers
    NSString *_peerIdentifier;
    NSString *_peerName;
    NSString *_serviceType;

    // The port on which the application level is listening
    uint _serverPort;

    // Map of sessions for all the peers we know about
    THESessionDictionary *_serverSessions;
}

-(id) initWithPeerId:(MCPeerID *)peerId 
    withPeerIdentifier:(NSString *)peerIdentifier 
          withPeerName:(NSString *)peerName
       withServiceType:(NSString *)serviceType
{
    self = [super init];
    if (!self)
    {
        return nil;
    }

    // Init the basic multipeer server session

    _localPeerId = peerId;

    _peerName = peerName;
    _peerIdentifier = peerIdentifier;
    _serviceType = serviceType;

    // peer name doubles up as server port in current impl.
    // This is the port the node server is listening to on localhost
    _serverPort = [peerName intValue];

    return self;
}

-(void) start
{
    NSLog(@"server: starting %@", _peerIdentifier);

    _serverSessions = [[THESessionDictionary alloc] init];

    // Start advertising our presence.. 
    _nearbyServiceAdvertiser = [[MCNearbyServiceAdvertiser alloc] 
        initWithPeer:_localPeerId 
       discoveryInfo:@{ PEER_IDENTIFIER_KEY: _peerIdentifier } 
         serviceType:_serviceType
    ];

    [_nearbyServiceAdvertiser setDelegate:self];
    [_nearbyServiceAdvertiser startAdvertisingPeer];
}

-(void) stop
{
  NSLog(@"server: stopping");

  [_nearbyServiceAdvertiser stopAdvertisingPeer];
  _nearbyServiceAdvertiser = nil;
    
  _serverSessions = nil;
}

// MCNearbyServiceAdvertiserDelegate
////////////////////////////////////

- (void)advertiser:(MCNearbyServiceAdvertiser *)advertiser
    didReceiveInvitationFromPeer:(MCPeerID *)peerID
                     withContext:(NSData *)context
               invitationHandler:(void (^)(BOOL accept, MCSession * session))invitationHandler
{
  __block MCSession *mcSession = nil;
 
  NSString *peerIdentifier = [[NSString alloc] initWithData:context encoding:NSUTF8StringEncoding];
  NSLog(@"server: didReceiveInvitationFromPeer %@", peerIdentifier);
  
  [_serverSessions updateForPeerID:peerID 
                       updateBlock:^THEMultipeerPeerSession *(THEMultipeerPeerSession *p) {

    THEMultipeerServerSession *serverSession = (THEMultipeerServerSession *)p;

    if (serverSession && ([[serverSession remotePeerID] hash] == [peerID hash]))
    {
      assert([[serverSession remotePeerIdentifier] isEqualToString:peerIdentifier]);

      NSLog(@"server: existing peer");
      // Disconnect any existing session, see note below
      [serverSession disconnect];
    }
    else
    {
      NSLog(@"server: new peer");
      serverSession = [[THEMultipeerServerSession alloc] initWithLocalPeerID:_localPeerId
                                                            withRemotePeerID:peerID
                                                    withRemotePeerIdentifier:peerIdentifier
                                                              withServerPort:_serverPort];
    }

    // Create a new session for each client, even if one already
    // existed. If we're seeing invitations from peers we already have sessions
    // with then the other side had restarted and our session is stale (we often
    // don't see the other side disconnect)

    mcSession = [serverSession connect];
    return serverSession;
  }];

  invitationHandler(YES, mcSession);
}

- (void)advertiser:(MCNearbyServiceAdvertiser *)advertiser didNotStartAdvertisingPeer:(NSError *)error
{
    NSLog(@"WARNING: server didNotStartAdvertisingPeer");
}

@end

