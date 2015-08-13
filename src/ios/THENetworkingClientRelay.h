#import <Foundation/Foundation.h>

#import "THENetworkingRelay.h"
#import "THESocketServerDelegate.h"

@interface THENetworkingClientRelay : THENetworkingRelay

@property (nonatomic, weak) id<THESocketServerDelegate> delegate;

-(instancetype)initWithPeerIdentifier:(NSString *)peerIdentifier;

@end
