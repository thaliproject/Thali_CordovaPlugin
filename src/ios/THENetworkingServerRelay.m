
#import "THENetworkingServerRelay.h"

@implementation THENetworkingServerRelay
{
    @private
    NSInputStream *_inputStream;
    NSOutputStream *_outputStream;
    uint _serverPort;
    GCDAsyncSocket *_socket;
}

-(instancetype)initWithInputStream:(NSInputStream *)inputStream
                  withOutputStream:(NSOutputStream *)outputStream
                    withServerPort:(uint)serverPort
{
    self = [super init];
    if (!self)
    {
        return nil;
    }
    
    _inputStream = inputStream;
    _outputStream = outputStream;
    _serverPort = serverPort;
    
    return self;
}

-(void)dealloc
{
    NSLog(@"server: relay stopping");
    [self stop];
}

-(BOOL)start
{
    if (_inputStream != nil && _outputStream != nil) 
    {
        NSLog(@"server: relay started");

        _socket = [[GCDAsyncSocket alloc] initWithDelegate:self delegateQueue:dispatch_get_main_queue()];
        
        NSError *err = nil;
        // This is the connection to the node server, passed in during startBroadcasting
        if (![_socket connectToHost:@"localhost" onPort:_serverPort withTimeout:-1 error:&err])
        {
            NSLog(@"server: relay socket connect error  %@",[err localizedDescription]);
            return NO;
        }
        else
        {
            NSLog(@"server: relay connected");
 
            _inputStream.delegate = self;
            [_inputStream scheduleInRunLoop:[NSRunLoop mainRunLoop] forMode:NSDefaultRunLoopMode];
            [_inputStream open];
            
            _outputStream.delegate = self;
            [_outputStream scheduleInRunLoop:[NSRunLoop mainRunLoop] forMode:NSDefaultRunLoopMode];
            [_outputStream open];
            
            [_socket readDataWithTimeout:-1 tag:1];
            
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
    NSLog(@"server: relay stopping");

    [_socket setDelegate:nil];
    [_socket disconnect];
    _socket = nil;

    _inputStream.delegate = nil;
    _outputStream.delegate = nil;

    [_inputStream removeFromRunLoop: [NSRunLoop currentRunLoop] forMode: NSDefaultRunLoopMode];
    [_outputStream removeFromRunLoop: [NSRunLoop currentRunLoop] forMode: NSDefaultRunLoopMode];
}

#pragma mark - NSStreamDelegate

-(void)stream:(NSStream *)aStream handleEvent:(NSStreamEvent)eventCode
{
    if (aStream == _inputStream) {
        switch (eventCode) {
            case NSStreamEventOpenCompleted:
            {
                NSLog(@"server: relay inputStream opened");
            }
            break;

            case NSStreamEventHasSpaceAvailable:
            break;

            case NSStreamEventHasBytesAvailable:
            {
                assert(_socket);
    
                NSLog(@"server: relay inputStream->socket");            

                // Read from input stream, write to socket
                const uint bufferValue = 1024; // 512, 1024 or 4k
                uint8_t *buffer = malloc(bufferValue);
                NSInteger len = [_inputStream read:buffer maxLength:sizeof(bufferValue)];
                NSMutableData *toWrite = [[NSMutableData alloc] init];
                [toWrite appendBytes:buffer length:len];
                [_socket writeData:toWrite withTimeout:-1 tag:0];
            }
            break;

            case NSStreamEventEndEncountered:
                NSLog(@"server: inputStream closed");
                break;
            case NSStreamEventErrorOccurred:
                NSLog(@"server: inputStream error");
                break;
            default:
                break;
        }
    }
    else if (aStream == _outputStream)
    {
        switch (eventCode) 
        {
            case NSStreamEventOpenCompleted:
            {
                NSLog(@"server: outputStream opened");
            }
            break;

            case NSStreamEventHasSpaceAvailable:
                break;
            case NSStreamEventHasBytesAvailable:
                break;

            case NSStreamEventEndEncountered:
            {
                NSLog(@"server: outputStream closed");
            }
            break;

            case NSStreamEventErrorOccurred:
            {
                NSLog(@"server: outputStream error");
            }
            break;

            default:
                break;
        }
    }
}

#pragma mark - GCDAsyncSocketDelegate

-(void)socket:(GCDAsyncSocket *)sock didAcceptNewSocket:(GCDAsyncSocket *)newSocket
{
    // Should never happen
    assert(false);
}

-(void)socket:(GCDAsyncSocket *)sock didConnectToHost:(NSString *)host port:(uint16_t)port
{
    [sock readDataWithTimeout:-1 tag:0];
}

-(void)socketDidDisconnect:(GCDAsyncSocket *)sock withError:(NSError *)err
{
    if (err) {
        NSLog(@"server: relay socket error '%@' on host:%@:%u", err, sock.connectedHost, sock.connectedPort);
    }
}

-(void)socket:(GCDAsyncSocket *)sock didWriteDataWithTag:(long)tag
{
}

-(void)socket:(GCDAsyncSocket *)sock didReadData:(NSData *)data withTag:(long)tag
{
    [_outputStream write:data.bytes maxLength:data.length];
    NSLog(@"server: socket->outputStream (%lu bytes)", (unsigned long)data.length);
    [_socket readDataWithTimeout:-1 tag:tag];
}

@end
