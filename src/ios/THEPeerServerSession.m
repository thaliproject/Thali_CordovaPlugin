#import "THEAppContext.h"
#import "THEPeerServerSession.h"
#import "THENetworkingClientRelay.h"

@implementation THEPeerServerSession
{
    MCPeerID *_remotePeerID;
    NSString *_remotePeerIdentifier;
}

- (instancetype)initWithLocalPeerID:(MCPeerID *)localPeerID
                   withRemotePeerID:(MCPeerID *)remotePeerID
           withRemotePeerIdentifier:(NSString *)remotePeerIdentifier
{
    self = [super initWithPeerID:localPeerID withSessionType:@"server"];
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

- (THENetworkingRelay *)createRelay
{
    THENetworkingClientRelay *clientRelay = [
        [THENetworkingClientRelay alloc] initWithPeerIdentifier:_remotePeerIdentifier
    ];
    [clientRelay setDelegate:(id<THESocketServerDelegate>)[THEAppContext singleton]];

    return clientRelay;
}

@end


