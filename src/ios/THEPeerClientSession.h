#import "THEPeerSession.h"

@interface THEPeerClientSession : THEPeerSession
    
@property (nonatomic) uint serverPort;
- (instancetype)initWithPeerID:(MCPeerID *)peerID withServerPort:(uint)serverPort;

@end
