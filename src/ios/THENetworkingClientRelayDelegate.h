// Forward declarations.
@class THENetworkingClientRelay;

@protocol THENetworkingClientRelayDelegate <NSObject>
@required
// Notifies the delegate of an available localport
- (void)didGetLocalPort:(uint)port withPeerIdentifier:(NSString*)peerIdentifier;
@end
