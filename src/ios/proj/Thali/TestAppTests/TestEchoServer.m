#import "TestEchoServer.h"

// TestEchoServer - Just accept sockets and echo everything they read back to them

@implementation TestEchoServer
{
  GCDAsyncSocket *_serverSocket;
  NSMutableArray<GCDAsyncSocket *> *_clientSockets;
}

- (BOOL)start:(unsigned short)port
{
  _clientSockets = [[NSMutableArray alloc] init];
  
  _serverSocket = [[GCDAsyncSocket alloc]
                    initWithDelegate:self
                       delegateQueue:dispatch_get_main_queue()];
  
  NSError *err;
  return [_serverSocket acceptOnPort:port error:&err];
}

- (BOOL)stop
{
  [_serverSocket setDelegate:nil];
  [_serverSocket disconnect];
  _serverSocket = nil;
  
  for (GCDAsyncSocket *sock in _clientSockets)
  {
    [sock setDelegate:nil];
    [sock disconnect];
  }
  
  return true;
}

- (void)socket:(GCDAsyncSocket *)sock didAcceptNewSocket:(GCDAsyncSocket *)acceptedSocket
{
  [_clientSockets addObject:acceptedSocket];
  [acceptedSocket readDataWithTimeout:-1 tag:0];
}

- (void)socket:(GCDAsyncSocket *)sock didReadData:(NSData *)data withTag:(long)tag
{
  [sock writeData:data withTimeout:-1 tag:0];
  [sock readDataWithTimeout:-1 tag:0];
}

@end
