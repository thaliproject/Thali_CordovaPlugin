// Forward declarations.
@class THENetworkingClientRelay;

@protocol THENetworkingClientRelayDelegate <NSObject>
@required

// Notifies the delegate of an available localport
- (void)networkingClientRelay:(THENetworkingClientRelay *)clientRelay didGetLocalPort:(uint)port withPeerIdentifier:(NSUUID*)peerIdentifier;

@end
