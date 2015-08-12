#import <Foundation/Foundation.h>
#import <MultipeerConnectivity/MultipeerConnectivity.h>

#import "GCDAsyncSocket.h"
#import "THEConnectionStatusDelegate.h"

@interface THENetworkingClientRelay : NSObject <GCDAsyncSocketDelegate, NSStreamDelegate, UIAlertViewDelegate>
{
    GCDAsyncSocket *serverSocket;
}

@property (nonatomic, weak) id<THEConnectionStatusDelegate> delegate;

// Setup a TCP listener on the client peer
-(instancetype)initWithInputStream:(NSInputStream *)inputStream
                  withOutputStream:(NSOutputStream *)outputStream
                withPeerIdentifier:(NSString *)peerIdentifier;

-(BOOL)start;
-(void)stop;

@end
