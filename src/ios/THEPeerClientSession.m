#import "THEPeerClientSession.h"
#import "THENetworkingServerRelay.h"

@implementation THEPeerClientSession

- (instancetype)initWithPeerID:(MCPeerID *)peerID
                withServerPort:(uint)serverPort
{
  self = [super initWithPeerID:peerID withSessionType:@"client"];
  if (!self)
  {
    return nil;
  }
    
  _serverPort = serverPort;

  return self;
}

- (THENetworkingRelay *)createRelay
{
  return [[THENetworkingServerRelay alloc] initWithServerPort:_serverPort];
}

/*
case MCSessionStateNotConnected:
{
NSLog(@"client: not connected");

THEPeerSessionState prevState = serverSession.connectionState;
[serverSession disconnect];

if (prevState == THEPeerSessionStateConnecting)
{
    NSLog(@"client: retrying connection");

    serverSession.clientSession = [[MCSession alloc] 
        initWithPeer: _peerId securityIdentity:nil encryptionPreference:MCEncryptionNone
    ];
    [serverSession.clientSession setDelegate:self];

    [self tryInviteToSessionWithPeerSession:serverSession];
}
}
break;
*/

@end
