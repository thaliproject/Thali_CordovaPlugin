#import <Foundation/Foundation.h>
#import "GCDAsyncSocket.h"
#import <MultipeerConnectivity/MultipeerConnectivity.h>

#import "THENetworkingServerRelayDelegate.h"

@interface THENetworkingServerRelay : NSObject <GCDAsyncSocketDelegate, NSStreamDelegate>
{
    GCDAsyncSocket *asyncSocket;
}

@property (nonatomic, weak) id<THENetworkingServerRelayDelegate> delegate;

-(instancetype)initWithInputStream:(NSInputStream *)inputStream
                  withOutputStream:(NSOutputStream *)outputStream
                            withPort:(uint)port
                  withPeerIdentifier:(NSUUID *)peerIdentifier;

-(BOOL)start;

@end
