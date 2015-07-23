#import <Foundation/Foundation.h>
#import "GCDAsyncSocket.h"
#import <MultipeerConnectivity/MultipeerConnectivity.h>

#import "THENetworkingServerRelayDelegate.h"

@interface THENetworkingServerRelay : NSObject <GCDAsyncSocketDelegate, NSStreamDelegate>

//@property (nonatomic, weak) id<THENetworkingServerRelayDelegate> delegate;

// Setup a TCP client on the server peer
-(instancetype)initWithInputStream:(NSInputStream *)inputStream
                  withOutputStream:(NSOutputStream *)outputStream
                          withPort:(uint)port;

-(BOOL)start;

@end
