
#import "THEMultipeerServerSocketRelay.h"

@implementation THEMultipeerServerSocketRelay
{
  // The server port we'll connect to
  unsigned short _serverPort;
  
  // Delegate we inform when we connect or fail
  id<THEMultipeerServerSocketRelayDelegate> _delegate;
  
  GCDAsyncSocket *_connectingSocket;
}

-(instancetype)initWithServerPort:(unsigned short)serverPort withDelegate:(id<THEMultipeerServerSocketRelayDelegate>)delegate;
{
  self = [super initWithRelayType:@"server"];
  if (!self)
  {
    return nil;
  }
  
  _delegate = delegate;
  _serverPort = serverPort;

  return self;
}

-(BOOL)tryCreateSocket
{
  if ([self canCreateSocket]) 
  {
    _connectingSocket = [[GCDAsyncSocket alloc] initWithDelegate:self 
                                                   delegateQueue:dispatch_get_main_queue()];

    NSError *err = nil;
    if (![_connectingSocket connectToHost:@"localhost" onPort:_serverPort withTimeout:5 error:&err])
    {
      NSLog(@"server: relay socket connect error  %@",[err localizedDescription]);
      return NO;
    }
    else
    {
      return YES;
    }
  }
  else
  {
    return NO;
  }
}

#pragma mark - GCDAsyncSocketDelegate

- (void)socket:(GCDAsyncSocket *)sock didConnectToHost:(NSString *)host port:(uint16_t)port
{
  NSLog(@"server relay: connected (to port: %d)", port);
  [self didCreateSocket:sock];
  [_delegate didConnectWithClientPort:[sock localPort] withServerPort:port];
  _connectingSocket = nil;
}

- (void)socketDidDisconnect:(GCDAsyncSocket *)sock withError:(NSError *)err
{
  if (_connectingSocket)
  {
    // Connection attempt has failed
    [_delegate didNotConnectWithServerPort:_serverPort];
  }
  
  [super socketDidDisconnect:sock withError:err];
}

@end
