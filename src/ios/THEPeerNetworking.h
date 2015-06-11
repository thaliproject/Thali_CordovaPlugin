//
//  THEPeerNetworking.h
//  ThaliMobile
//
//  Created by Brian Lambert on 5/13/15.
//
//

#import <Foundation/Foundation.h>
#import "THEPeerNetworkingDelegate.h"

// THEPeerNetworking interface.
@interface THEPeerNetworking : NSObject

// Properties.
@property (nonatomic, weak) id<THEPeerNetworkingDelegate> delegate;

// Class initializer.
- (instancetype)initWithServiceType:(NSString *)serviceType
                     peerIdentifier:(NSUUID *)peerIdentifier
                           peerName:(NSString *)peerName;

// Starts peer networking.
- (void)start;

// Stops peer networking.
- (void)stop;

// Connects to the peer server with the specified peer identifier.
- (BOOL)connectToPeerServerWithPeerIdentifier:(NSUUID *)peerIdentifier;

// Connects from the peer server with the specified peer identifier.
- (BOOL)disconnectFromPeerServerWithPeerIdentifier:(NSUUID *)peerIdentifier;

@end
