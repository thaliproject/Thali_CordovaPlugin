#import "THENetworkingClientRelay.h"

@implementation THENetworkingClientRelay
{
@private
    NSInputStream *_inputStream;
    NSOutputStream *_outputStream;
    NSString *_peerIdentifier;
    GCDAsyncSocket *_socket;
}

-(instancetype)initWithInputStream:(NSInputStream *)inputStream
                  withOutputStream:(NSOutputStream *)outputStream
                withPeerIdentifier:(NSString *)peerIdentifier
{
    self = [super init];
    // Handle errors.
    if (!self)
    {
        return nil;
    }
    
    _inputStream = inputStream;
    _outputStream = outputStream;
    _peerIdentifier = peerIdentifier;
    
    return self;
}

-(BOOL)start
{
    if (_inputStream != nil && _outputStream != nil) 
    {
        NSLog(@"client: relay started");

        serverSocket = [[GCDAsyncSocket alloc] initWithDelegate:self delegateQueue:dispatch_get_main_queue()];
        
        NSError *err = nil;
        if (![serverSocket acceptOnPort:0 error:&err])
        {
            NSLog(@"client: relay failed to listen");
            return NO;
        }
        else
        {
            UInt16 port = [serverSocket localPort];
            if ([self.delegate respondsToSelector:@selector(didGetLocalPort:withPeerIdentifier:)])
            {
                // This is the port to which the node client will connect in order
                // to talk to the server
  
                NSLog(@"client: relay calling didGetLocalPort");
                [self.delegate didGetLocalPort:port withPeerIdentifier:_peerIdentifier];
            }
            
            return YES;
        }
    }
    else
    {
        return NO;
    }
}

-(void)stop
{
    [_socket setDelegate:nil];
    [_socket disconnect];
    _socket = nil;

    _inputStream.delegate = nil;
    _outputStream.delegate = nil;

    [_inputStream removeFromRunLoop: [NSRunLoop currentRunLoop] forMode: NSDefaultRunLoopMode];
    [_outputStream removeFromRunLoop: [NSRunLoop currentRunLoop] forMode: NSDefaultRunLoopMode];
}

-(void)stream:(NSStream *)stream handleEvent:(NSStreamEvent)eventCode
{
    if (stream == _inputStream) 
    {
        switch (eventCode) 
        {
            case NSStreamEventOpenCompleted:
            break;
            
            case NSStreamEventHasSpaceAvailable:
            break;

            case NSStreamEventHasBytesAvailable:
            {
                assert(_socket);
                

                // Read from input stream, write to socket
                const uint bufferValue = 1024; // 512, 1024 or 4k
                uint8_t *buffer = malloc(bufferValue);
                NSInteger len = [_inputStream read:buffer maxLength:sizeof(bufferValue)];
                NSMutableData *toWrite = [[NSMutableData alloc] init];
                [toWrite appendBytes:buffer length:len];
                [_socket writeData:toWrite withTimeout:-1 tag:0];

                NSLog(@"client: inputStream->_socket (%ld bytes)", (long)len);
            }
            break;

            case NSStreamEventEndEncountered:
            {
                NSLog(@"client: relay inputStream ended");
            } 
            break;

            case NSStreamEventErrorOccurred:
            {
                NSLog(@"client: relay inputStream error");
            }
            break;

            default: 
            {
                NSLog(@"client: Unexpected case statement");
            }
            break;
        }
    }
    else if (stream == _outputStream)
    {
        switch (eventCode) 
        {
            case NSStreamEventOpenCompleted:
            break;
            case NSStreamEventHasSpaceAvailable:
            break;
            case NSStreamEventHasBytesAvailable:
            break;
            case NSStreamEventEndEncountered:
            break;
            case NSStreamEventErrorOccurred:
            break;
            default:
            break;
        }
    }
}

#pragma mark - GCDAsyncSocketDelegate

-(void)socket:(GCDAsyncSocket *)sock didAcceptNewSocket:(GCDAsyncSocket *)newSocket
{
    NSLog(@"client: relay accepted socket");
    
    _socket = newSocket;
    
    _inputStream.delegate = self;
    [_inputStream scheduleInRunLoop:[NSRunLoop mainRunLoop] forMode:NSDefaultRunLoopMode];
    [_inputStream open];
    
    _outputStream.delegate = self;
    [_outputStream scheduleInRunLoop:[NSRunLoop mainRunLoop] forMode:NSDefaultRunLoopMode];
    [_outputStream open];
    
    [_socket readDataWithTimeout:-1 tag:1];
}

-(void)socketDidDisconnect:(GCDAsyncSocket *)sock withError:(NSError *)err
{
    assert(sock == _socket);

    if (err) {
        NSLog(@"client: relay socket disconneted:  %@", [err description]);
    }
}

-(void)socket:(GCDAsyncSocket *)sock didWriteDataWithTag:(long)tag
{
    assert(sock == _socket);
}

-(void)socket:(GCDAsyncSocket *)sock didReadData:(NSData *)data withTag:(long)tag
{
    assert(sock == _socket);

    NSLog(@"client: socket->outputStream (%lu)", (unsigned long)data.length);
    if ([_outputStream write:data.bytes maxLength:data.length] == -1)
    {
        NSLog(@"ERROR: Writing to output stream");
    }
    [_socket readDataWithTimeout:-1 tag:tag];
}

@end
