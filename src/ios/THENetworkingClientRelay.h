#import <Foundation/Foundation.h>
#import "GCDAsyncSocket.h"
#import <MultipeerConnectivity/MultipeerConnectivity.h>

#import "THENetworkingClientRelayDelegate.h"

@interface THENetworkingClientRelay : NSObject <GCDAsyncSocketDelegate, NSStreamDelegate, UIAlertViewDelegate>
{
    GCDAsyncSocket *serverSocket;
}

@property (nonatomic, weak) id<THENetworkingClientRelayDelegate> delegate;

// Setup a TCP listener on the client peer
-(instancetype)initWithInputStream:(NSInputStream *)inputStream
                  withOutputStream:(NSOutputStream *)outputStream
                withPeerIdentifier:(NSString *)peerIdentifier;

-(BOOL)start;
-(void)stop;

@end
