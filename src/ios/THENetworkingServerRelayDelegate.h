// Forward declarations.
@class THENetworkingServerRelay;

@protocol THENetworkingServerRelayDelegate <NSObject>
@required

// Notifies the delegate that of a localport
- (void)networkingServerRelay:(THENetworkingServerRelay *)serverRelay didGetLocalPort:(uint)port withPeerIdentifier:(NSUUID*)peerIdentifier;

@end