#import <Foundation/Foundation.h>
#import "GCDAsyncSocket.h"
#import <MultipeerConnectivity/MultipeerConnectivity.h>

#import "THENetworkingServerRelayDelegate.h"

@interface THENetworkingServerRelay : NSObject <GCDAsyncSocketDelegate, NSStreamDelegate>

-(instancetype)initWithInputStream:(NSInputStream *)inputStream
                  withOutputStream:(NSOutputStream *)outputStream
                    withServerPort:(uint)port;

-(BOOL)start;
-(void)stop;

@end
