#import "THEMultipeerClientSocketRelay.h"

@implementation THEMultipeerClientSocketRelay
{
  NSString *_peerIdentifier;
  GCDAsyncSocket *_serverSocket;
}

-(instancetype)initWithPeerIdentifier:(NSString *)peerIdentifier
{
  self = [super initWithRelayType:@"client"];
  if (!self)
  {
    return nil;
  }
    
  _peerIdentifier = peerIdentifier;
    
  return self;
}

-(void)dealloc
{
  NSLog(@"client: relay dealloc");

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

    NSLog(@"client: new server socket: %p", _serverSocket);        

    NSError *err = nil;
    if (![_serverSocket acceptOnPort:0 error:&err])
    {
      NSString *errorMsg = @"relay failed to listen";

      NSLog(@"client: %@", errorMsg);
      if ([self.delegate respondsToSelector:@selector(
        didNotListenWithErrorMessage:withPeerIdentifier:)])
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
  // Application has connected to us, the |acceptedSocket| is the one we'll talk to it on
  NSLog(@"client: relay established");
  NSLog(@"client: new accepted socket: %p", acceptedSocket);        
  [self didCreateSocket: acceptedSocket];
}

@end
