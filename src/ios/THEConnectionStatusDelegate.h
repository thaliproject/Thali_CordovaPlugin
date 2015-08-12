
@protocol THEConnectionStatusDelegate <NSObject>
@required
- (void)didConnectWithLocalPort:(uint)port withPeerIdentifier:(NSString*)peerIdentifier;
- (void)didNotConnectWithErrorMessage:(NSString *)errorMsg withPeerIdentifier:(NSString*)peerIdentifier;
@end
