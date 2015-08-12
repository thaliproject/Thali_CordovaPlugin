#import <Foundation/Foundation.h>
#import "GCDAsyncSocket.h"
#import <MultipeerConnectivity/MultipeerConnectivity.h>

@interface THENetworkingServerRelay : NSObject <GCDAsyncSocketDelegate, NSStreamDelegate>

-(instancetype)initWithInputStream:(NSInputStream *)inputStream
                  withOutputStream:(NSOutputStream *)outputStream
                    withServerPort:(uint)port;

-(BOOL)start;
-(void)stop;
-(void)dealloc;

@end
