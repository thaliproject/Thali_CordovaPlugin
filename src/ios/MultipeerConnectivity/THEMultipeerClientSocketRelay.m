#import "THEMultipeerClientSocketRelay.h"

@implementation THEMultipeerClientSocketRelay
{
  NSString *_peerIdentifier;
  GCDAsyncSocket *_serverSocket;

  __weak id<THEMultipeerClientSocketRelayDelegate> _delegate;
}

-(instancetype)initWithPeerIdentifier:(NSString *)peerIdentifier 
                         withDelegate:(id<THEMultipeerClientSocketRelayDelegate>) delegate
{
  self = [super initWithRelayType:@"client"];
  if (!self)
  {
    return nil;
  }
 
  _delegate = delegate;   
  _peerIdentifier = peerIdentifier;

  return self;
}

-(void)dealloc
{
  [_serverSocket setDelegate:nil];
  _serverSocket = nil;
}

-(BOOL)tryCreateSocket
{
  if ([self canCreateSocket]) 
  {
    // Set up a server socket to listen for incoming connections from the 
    // application

    _serverSocket = [[GCDAsyncSocket alloc] 
                        initWithDelegate:self 
                           delegateQueue:dispatch_get_main_queue()];

    NSError *err = nil;
    if (![_serverSocket acceptOnPort:0 error:&err])
    {
      NSString *errorMsg = @"relay failed to listen";

      NSLog(@"client: %@", errorMsg);
      [_delegate didNotListenWithErrorMessage:errorMsg withPeerIdentifier:_peerIdentifier];

      return NO;
    }
    else
    {
      UInt16 port = [_serverSocket localPort];
      [_delegate didListenWithLocalPort:port withPeerIdentifier:_peerIdentifier];
        
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
  // Application has connected to us, the |acceptedSocket| is the one we'll talk to it on
  NSLog(@"client: relay established");
  NSLog(@"client: new accepted socket: %p", acceptedSocket);        
  [self didCreateSocket: acceptedSocket];
}

@end
