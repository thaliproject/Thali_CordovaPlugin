#import <Foundation/Foundation.h>
#import "GCDAsyncSocket.h"
#import <MultipeerConnectivity/MultipeerConnectivity.h>

#import "THENetworkingClientRelayDelegate.h"

@interface THENetworkingClientRelay : NSObject <GCDAsyncSocketDelegate, NSStreamDelegate>
{
    GCDAsyncSocket *asyncSocket;
}

@property (nonatomic, weak) id<THENetworkingClientRelayDelegate> delegate;

-(instancetype)initWithMPInputStream:(NSInputStream *)inputStream
                  withMPOutputStream:(NSOutputStream *)outputStream
                            withPort:(uint)port;

-(BOOL)start;

@end
