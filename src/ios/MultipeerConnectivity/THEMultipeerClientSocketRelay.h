#import <Foundation/Foundation.h>

#import "THEMultipeerSocketRelay.h"
#import "THEMultipeerClientSocketRelayDelegate.h"

// Networking relay created on the client in order bridge across the multipeer
// session to a server. In this class we'll establish a listening socket to which the application
// can connect as though the server was running locally and we'll send/receive data over
// the multipeer session to the real server application running on the remote peer
@interface THEMultipeerClientSocketRelay : THEMultipeerSocketRelay

@property (nonatomic, weak) id<THEMultipeerClientSocketRelayDelegate> delegate;

- (instancetype)initWithPeerIdentifier:(NSString *)peerIdentifier;

@end
