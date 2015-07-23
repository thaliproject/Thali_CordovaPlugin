// Forward declarations.
@class THENetworkingClientRelay;

@protocol THENetworkingClientRelayDelegate <NSObject>
@optional

// Notifies the delegate of an available localport
- (void)networkingClientRelay:(THENetworkingClientRelay *)clientRelay didGetLocalPort:(uint)port withPeerIdentifier:(NSUUID*)peerIdentifier;


@end
