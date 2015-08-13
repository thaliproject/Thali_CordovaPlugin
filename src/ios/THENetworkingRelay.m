#import "THENetworkingRelay.h"

@implementation THENetworkingRelay
{
    GCDAsyncSocket *_socket;

    NSInputStream *_inputStream;
    NSOutputStream *_outputStream;
}

-(void)setInputStream:(NSInputStream *)inputStream
{
    assert(inputStream && _inputStream == nil);
    _inputStream = inputStream;
    [self tryCreateSocket];
}

-(void)setOutputStream:(NSOutputStream *)outputStream
{
    assert(outputStream && _outputStream == nil);
    _outputStream = outputStream;
    [self tryCreateSocket];
}

-(void)openStreams
{
    assert(_inputStream && _outputStream && _socket);

    _inputStream.delegate = self;
    [_inputStream scheduleInRunLoop:[NSRunLoop mainRunLoop] forMode:NSDefaultRunLoopMode];
    [_inputStream open];
    
    _outputStream.delegate = self;
    [_outputStream scheduleInRunLoop:[NSRunLoop mainRunLoop] forMode:NSDefaultRunLoopMode];
    [_outputStream open];
}

-(BOOL)canCreateSocket
{
    return (_inputStream && _outputStream);
}

-(BOOL)tryCreateSocket
{
    return YES;
}

-(void)didCreateSocket:(GCDAsyncSocket *)socket
{
    assert(_socket == nil);

    _socket = socket;
    [self openStreams];

    [_socket readDataWithTimeout:-1 tag:0];
}


-(void)dealloc
{
    NSLog(@"relay: dealloc");

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


-(void)socket:(GCDAsyncSocket *)sock didReadData:(NSData *)data withTag:(long)tag
{
    assert(sock == _socket);
    assert(_outputStream != nil);

    NSLog(@"relay: socket->outputStream (%lu)", (unsigned long)data.length);
    if ([_outputStream write:data.bytes maxLength:data.length] == -1)
    {
        NSLog(@"ERROR: Writing to output stream");
    }

    [_socket readDataWithTimeout:-1 tag:tag];
}

-(void)socketDidDisconnect:(GCDAsyncSocket *)sock withError:(NSError *)err
{
    assert(sock == _socket);

    if (err) 
    {
        NSLog(@"client: relay socket disconneted:  %@", [err description]);
    }
}

#pragma mark - NSStreamDelegate

-(void)stream:(NSStream *)aStream handleEvent:(NSStreamEvent)eventCode
{
    NSLog(@"relay: streamEvent in");

    @synchronized(self)
    {
        if (aStream == _inputStream) 
        {
            switch (eventCode) 
            {
                case NSStreamEventOpenCompleted:
                {
                    NSLog(@"relay: inputStream opened");
                }
                break;

                case NSStreamEventHasSpaceAvailable:
                {
                    NSLog(@"relay: inputStream hasSpace");
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
                    [_socket writeData:toWrite withTimeout:-1 tag:0];
                }
                break;

                case NSStreamEventEndEncountered:
                {
                    NSLog(@"relay: inputStream closed");
                }
                break;

                case NSStreamEventErrorOccurred:
                {
                    NSLog(@"relay: inputStream error");
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
                    NSLog(@"relay: outputStream opened");
                }
                break;

                case NSStreamEventHasSpaceAvailable:
                {
                    NSLog(@"relay: outputStream hasSpace");
                }
                break;

                case NSStreamEventHasBytesAvailable:
                {
                    NSLog(@"relay: outputStream hasBytes");
                }
                break;

                case NSStreamEventEndEncountered:
                {
                    NSLog(@"relay: outputStream closed");
                }
                break;

                case NSStreamEventErrorOccurred:
                {
                    NSLog(@"relay: outputStream error");
                }
                break;

                default:
                {
                }
                break;
            }
        }
    }
    NSLog(@"relay: streamEvent out");
}
@end
