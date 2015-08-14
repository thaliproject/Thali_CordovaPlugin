#import "THEPeerSession.h"

@interface THEPeerServerSession : THEPeerSession

    @property (nonatomic) uint connectRetries;

    -(MCPeerID *)peerID;
    -(NSString *)peerIdentifier;

    -(instancetype)initWithLocalPeerID:(MCPeerID *)localPeer 
                      withRemotePeerID:(MCPeerID *)remotePeer 
              withRemotePeerIdentifier:(NSString *)peerIdentifier;

@end;


