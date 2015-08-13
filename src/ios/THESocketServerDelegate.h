
@protocol THESocketServerDelegate <NSObject>
- (void)didListenWithLocalPort:(uint)port withPeerIdentifier:(NSString*)peerIdentifier;
- (void)didNotListenWithErrorMessage:(NSString *)errorMsg withPeerIdentifier:(NSString*)peerIdentifier;
@end
