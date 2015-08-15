#import "THENetworkingRelay.h"

@interface THENetworkingRelay()

// Try to open the socket
- (BOOL)tryCreateSocket;

@end

@implementation THENetworkingRelay
{
  // The socket we're using to talk to the upper (localhost) layers
  GCDAsyncSocket *_socket;

  // The input and output stream that we use to talk to the remote peer
  NSInputStream *_inputStream;
  NSOutputStream *_outputStream;

  // For debugging purposes only
  NSString *_relayType;
}

- (instancetype)initWithRelayType:(NSString *)relayType
{
  if (self = [super init]) 
  { 
    _relayType = relayType;
  }
  return self;
}

- (instancetype)init
{
  return [self initWithRelayType:@"unknown"];
}

- (void)setInputStream:(NSInputStream *)inputStream
{
  // inputStream is from the multipeer session, data from the remote
  // peer will appear here
  assert(inputStream && _inputStream == nil);
  _inputStream = inputStream;
  [self tryCreateSocket];
}

- (void)setOutputStream:(NSOutputStream *)outputStream
{
  // outputStream is from the multipeer session, data written here will
  // be sent to the remote peer
  assert(outputStream && _outputStream == nil);
  _outputStream = outputStream;
  [self tryCreateSocket];
}

- (void)openStreams
{
  // Everything's in place so let's start the streams to let the data flow

  assert(_inputStream && _outputStream && _socket);

  _inputStream.delegate = self;
  [_inputStream scheduleInRunLoop:[NSRunLoop mainRunLoop] forMode:NSDefaultRunLoopMode];
  [_inputStream open];
  
  _outputStream.delegate = self;
  [_outputStream scheduleInRunLoop:[NSRunLoop mainRunLoop] forMode:NSDefaultRunLoopMode];
  [_outputStream open];
}

- (BOOL)canCreateSocket
{
  // Postpone socket creation until we know we have somewhere to send
  // it's data
  return (_inputStream && _outputStream);
}

- (BOOL)tryCreateSocket
{
  // Base class only. Shouldn't be reachable
  assert(NO);
  return NO;
}

- (void)didCreateSocket:(GCDAsyncSocket *)socket
{
  // Socket's been created which means we can open up the stream
  assert(_socket == nil);

  _socket = socket;
  [self openStreams];
  [_socket readDataWithTimeout:-1 tag:0];
}


- (void)dealloc
{
  NSLog(@"%@ relay: dealloc", _relayType);

  // Make sure we detach from and shut down the streams else they may try to call us
  // back after we're dead

  [_inputStream setDelegate: nil];
  [_outputStream setDelegate: nil];

  [_socket setDelegate: nil];
  [_socket disconnect];
  _socket = nil;

  [_inputStream close];
  [_outputStream close];

  [_inputStream removeFromRunLoop: [NSRunLoop currentRunLoop] forMode: NSDefaultRunLoopMode];
  [_outputStream removeFromRunLoop: [NSRunLoop currentRunLoop] forMode: NSDefaultRunLoopMode];

  _inputStream = nil;
  _outputStream = nil;
}


- (void)socket:(GCDAsyncSocket *)sock didReadData:(NSData *)data withTag:(long)tag
{
  assert(sock == _socket);
  assert(_outputStream != nil);

  NSLog(@"%@ relay: socket->outputStream (%lu)", _relayType, (unsigned long)data.length);
  if ([_outputStream write:data.bytes maxLength:data.length] != data.length)
  {
    NSLog(@"ERROR: Writing to output stream");
  }

  [_socket readDataWithTimeout:-1 tag:tag];
}

- (void)socket:(GCDAsyncSocket *)sock didWriteDataWithTag:(long)tag
{
  NSLog(@"%@ relay: wrote %ld bytes", _relayType, tag);
}

- (void)socketDidDisconnect:(GCDAsyncSocket *)sock withError:(NSError *)err
{
  assert(sock == _socket);

  // Usually benign, the upper layer just closed their connection
  // they may want to connect again later

  NSLog(@"%@ relay: socket disconnected", _relayType);

  if (err) 
  {
      NSLog(@"%@ relay: disconnected with error %@", _relayType, [err description]);
  }
}

#pragma mark - NSStreamDelegate

- (void)stream:(NSStream *)aStream handleEvent:(NSStreamEvent)eventCode
{
  NSLog(@"%@ relay: streamEvent in", _relayType);

  if (aStream == _inputStream) 
  {
    switch (eventCode) 
    {
      case NSStreamEventOpenCompleted:
      {
        NSLog(@"%@ relay: inputStream opened", _relayType);
      }
      break;

      case NSStreamEventHasSpaceAvailable:
      {
        NSLog(@"%@ relay: inputStream hasSpace", _relayType);
      }
      break;

      case NSStreamEventHasBytesAvailable:
      {
        const uint bufferValue = 1024;
        uint8_t *buffer = malloc(bufferValue);
        NSInteger len = [_inputStream read:buffer maxLength:sizeof(bufferValue)];
        NSMutableData *toWrite = [[NSMutableData alloc] init];
        [toWrite appendBytes:buffer length:len];

        assert(_socket);
        [_socket writeData:toWrite withTimeout:-1 tag:len];
        NSLog(@"%@ relay: inputStream->socket (%lu)", _relayType, (unsigned long)len);
      }
      break;

      case NSStreamEventEndEncountered:
      {
        NSLog(@"%@ relay: inputStream closed", _relayType);
      }
      break;

      case NSStreamEventErrorOccurred:
      {
        NSLog(@"%@ relay: inputStream error", _relayType);
      }
      break;

      default:
      {
      }
      break;
    }
  }
  else if (aStream == _outputStream)
  {
    switch (eventCode) 
    {
      case NSStreamEventOpenCompleted:
      {
        NSLog(@"%@ relay: outputStream opened", _relayType);
      }
      break;

      case NSStreamEventHasSpaceAvailable:
      {
        NSLog(@"%@ relay: outputStream hasSpace", _relayType);
      }
      break;

      case NSStreamEventHasBytesAvailable:
      {
        NSLog(@"%@ relay: outputStream hasBytes", _relayType);
      }
      break;

      case NSStreamEventEndEncountered:
      {
        NSLog(@"%@ relay: outputStream closed", _relayType);
      }
      break;

      case NSStreamEventErrorOccurred:
      {
        NSLog(@"%@ relay: outputStream error", _relayType);
      }
      break;

      default:
      {
      }
      break;
    }
  }
  NSLog(@"%@ relay: streamEvent out", _relayType);
}
@end
