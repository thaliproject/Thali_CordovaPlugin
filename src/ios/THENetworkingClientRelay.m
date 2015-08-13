#import "THENetworkingClientRelay.h"

@implementation THENetworkingClientRelay
{
@private
    NSString *_peerIdentifier;
    GCDAsyncSocket *_serverSocket;
}

-(instancetype)initWithPeerIdentifier:(NSString *)peerIdentifier
{
    self = [super init];
    if (!self)
    {
        return nil;
    }
    
    _peerIdentifier = peerIdentifier;
    
    return self;
}

-(void)dealloc
{
    NSLog(@"client: relay destructing");

    [_serverSocket setDelegate:nil];
    _serverSocket = nil;
}

-(BOOL)tryCreateSocket
{
    if ([self canCreateSocket]) 
    {
        NSLog(@"client: relay starting");

        _serverSocket = [[GCDAsyncSocket alloc] initWithDelegate:self delegateQueue:dispatch_get_main_queue()];
        
        NSError *err = nil;
        if (![_serverSocket acceptOnPort:0 error:&err])
        {
            NSString *errorMsg = @"relay failed to listen";

            NSLog(@"client: %@", errorMsg);
            if ([self.delegate respondsToSelector:@selector(didNotListenWithErrorMessage:withPeerIdentifier:)])
            {
                [self.delegate didNotListenWithErrorMessage:errorMsg withPeerIdentifier:_peerIdentifier];
            }

            return NO;
        }
        else
        {
            UInt16 port = [_serverSocket localPort];
            if ([self.delegate respondsToSelector:@selector(didListenWithLocalPort:withPeerIdentifier:)])
            {
                NSLog(@"client: relay started");
                [self.delegate didListenWithLocalPort:port withPeerIdentifier:_peerIdentifier];
            }
        
            return YES;
        }
    }
    else
    {
        return NO;
    }
}

#pragma mark - GCDAsyncSocketDelegate

-(void)socket:(GCDAsyncSocket *)sock didAcceptNewSocket:(GCDAsyncSocket *)acceptedSocket
{
    NSLog(@"client: relay established");
    [self didCreateSocket: acceptedSocket];
}

@end
