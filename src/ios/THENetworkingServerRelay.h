#import <Foundation/Foundation.h>
#import <MultipeerConnectivity/MultipeerConnectivity.h>

#import "THENetworkingRelay.h"

@interface THENetworkingServerRelay : THENetworkingRelay

-(instancetype)initWithServerPort:(uint)port;

@end
