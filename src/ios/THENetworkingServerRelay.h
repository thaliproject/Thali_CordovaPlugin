#import <Foundation/Foundation.h>
#import "GCDAsyncSocket.h"
#import <MultipeerConnectivity/MultipeerConnectivity.h>

#import "THENetworkingServerRelayDelegate.h"

@interface THENetworkingServerRelay : NSObject <GCDAsyncSocketDelegate, NSStreamDelegate>
{
    GCDAsyncSocket *asyncSocket;
}

@property (nonatomic, weak) id<THENetworkingServerRelayDelegate> delegate;

-(instancetype)initWithMPInputStream:(NSInputStream *)inputStream
                  withMPOutputStream:(NSOutputStream *)outputStream
                            withPort:(uint)port;

-(BOOL)start;

@end
