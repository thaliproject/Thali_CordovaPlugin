#import <Foundation/Foundation.h>
#import "GCDAsyncSocket.h"
#import <MultipeerConnectivity/MultipeerConnectivity.h>

#import "THENetworkingClientRelayDelegate.h"

@interface THENetworkingClientRelay : NSObject <GCDAsyncSocketDelegate, NSStreamDelegate, UIAlertViewDelegate>
{
    GCDAsyncSocket *asyncSocket;
}

@property (nonatomic, weak) id<THENetworkingClientRelayDelegate> delegate;

// Setup a TCP listener on the client peer
-(instancetype)initWithInputStream:(NSInputStream *)inputStream
                  withOutputStream:(NSOutputStream *)outputStream
//                          withPort:(uint)port
                withPeerIdentifier:(NSUUID *)peerIdentifier;

-(BOOL)start;

@end
