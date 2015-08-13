
#import "THENetworkingServerRelay.h"

@implementation THENetworkingServerRelay
{
    uint _serverPort;
}

-(instancetype)initWithServerPort:(uint)serverPort
{
    self = [super init];
    if (!self)
    {
        return nil;
    }
    
    _serverPort = serverPort;
    
    return self;
}

-(BOOL)tryCreateSocket
{
    if ([self canCreateSocket]) 
    {
        NSLog(@"server: relay starting");
 
        GCDAsyncSocket *socket = [[GCDAsyncSocket alloc] initWithDelegate:self delegateQueue:dispatch_get_main_queue()];
        
        NSError *err = nil;
        if (![socket connectToHost:@"localhost" onPort:_serverPort withTimeout:-1 error:&err])
        {
            NSLog(@"server: relay socket connect error  %@",[err localizedDescription]);
            return NO;
        }
        else
        {
            NSLog(@"server: relay started");
            return YES;
        }
    }
    else
    {
        return NO;
    }
}

#pragma mark - GCDAsyncSocketDelegate

-(void)socket:(GCDAsyncSocket *)sock didConnectToHost:(NSString *)host port:(uint16_t)port
{
    NSLog(@"server: relay established");
    [self didCreateSocket:sock];
}

@end
