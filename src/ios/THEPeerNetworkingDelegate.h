//
//  THEPeerNetworkingDelegate.h
//  ThaliMobile
//
//  Created by Brian Lambert on 5/13/15.
//
//

// Forward declarations.
@class THEPeerNetworking;

// THEPeerNetworkingDelegate protocol.
@protocol THEPeerNetworkingDelegate <NSObject>
@required

// Notifies the delegate that a peer was found.
- (void)peerNetworking:(THEPeerNetworking *)peerNetworking
 didFindPeerIdentifier:(NSUUID *)peerIdentifier
              peerName:(NSString *)peerName;

// Notifies the delegate that a peer was lost.
- (void)peerNetworking:(THEPeerNetworking *)peerNetworking
 didLosePeerIdentifier:(NSUUID *)peerIdentifier;

// Notifies the delegate that the peer networking client is connecting to the specified peer networking server.
- (void)peerNetworking:(THEPeerNetworking *)peerNetworking
connectingToPeerServerWithPeerIdentifier:(NSUUID *)peerIdentifier;

// Notifies the delegate that the peer networking client is connected to the specified peer networking server.
- (void)peerNetworking:(THEPeerNetworking *)peerNetworking
connectedToPeerServerWithPeerIdentifier:(NSUUID *)peerIdentifier;

// Notifies the delegate that peer networking client is not connected to the specified peer networking server.
- (void)peerNetworking:(THEPeerNetworking *)peerNetworking
notConnectedToPeerServerWithPeerIdentifier:(NSUUID *)peerIdentifier;

// Notifies the delegate that the specified peer networking client is connecting to the peer networking server.
- (void)peerNetworking:(THEPeerNetworking *)peerNetworking
peerClientConnectingWithPeerIdentifier:(NSUUID *)peerIdentifier;

// Notifies the delegate that the specified peer networking client is connected to the peer networking server.
- (void)peerNetworking:(THEPeerNetworking *)peerNetworking
peerClientConnectedWithPeerIdentifier:(NSUUID *)peerIdentifier;

// Notifies the delegate that the specified peer networking client is not connected to the peer networking server.
- (void)peerNetworking:(THEPeerNetworking *)peerNetworking
peerClientNotConnectedWithPeerIdentifier:(NSUUID *)peerIdentifier;

@end
