
#import "THENetworkingServerRelay.h"

@implementation THENetworkingServerRelay
{
    @private
    NSInputStream *aInputStream;
    NSOutputStream *aOutputStream;
    uint aPort;
    GCDAsyncSocket *aSocket;
}

-(instancetype)initWithInputStream:(NSInputStream *)inputStream
                  withOutputStream:(NSOutputStream *)outputStream
                          withPort:(uint)port
{
    self = [super init];
    // Handle errors.
    if (!self)
    {
        return nil;
    }
    
    aInputStream = inputStream;
    aOutputStream = outputStream;
    aPort = port;
    
    return self;
}

-(BOOL)start
{
    if (aInputStream != nil && aOutputStream != nil) {
        // check is open...
        
        aSocket = [[GCDAsyncSocket alloc] initWithDelegate:self delegateQueue:dispatch_get_main_queue()];
        
        NSError *err = nil;
        if (![aSocket connectToHost:@"localhost" onPort:aPort withTimeout:-1 error:&err])
        {
            NSLog(@"ServerRelay setup error on port:%u %@", aPort, err);
            return NO;
        }
        else
        {
            aInputStream.delegate = self;
            [aInputStream scheduleInRunLoop:[NSRunLoop mainRunLoop] forMode:NSDefaultRunLoopMode];
            [aInputStream open];
            
            aOutputStream.delegate = self;
            [aOutputStream scheduleInRunLoop:[NSRunLoop mainRunLoop] forMode:NSDefaultRunLoopMode];
            [aOutputStream open];
            
            //NSData *data = [@"World" dataUsingEncoding:NSUTF8StringEncoding];
            //NSLog(@"ServerRelay data via port:%u data:%@", aPort, [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] );
            
            //[asyncSocket writeData:data withTimeout:-1 tag:1];
            //[asyncSocket readDataToData:data withTimeout:-1 tag:1];
            [aSocket readDataWithTimeout:-1 tag:1];
            
            return YES;
        }
        
    }
    else
    {
        return NO;
    }
}

#pragma mark - NSStreamDelegate

-(void)stream:(NSStream *)aStream handleEvent:(NSStreamEvent)eventCode
{
    if (aStream == aInputStream) {
        NSLog(@"ServerRelay aStream aInputStream: %lu", (unsigned long)eventCode);
        switch (eventCode) {
            case NSStreamEventOpenCompleted:
                break;
            case NSStreamEventHasSpaceAvailable:
                break;
            case NSStreamEventHasBytesAvailable:
            {
                assert(aSocket);
                // Read from input stream, write to socket
                
                const uint bufferSize = 1024;
                
                uint8_t *buffer = malloc(bufferSize);
                
                [aInputStream read:buffer maxLength:bufferSize];
                
                NSData *toWrite = [[NSData alloc] initWithBytesNoCopy:buffer length:bufferSize];
                
                
                [aSocket writeData:toWrite withTimeout:-1 tag:0];
            }
                break;
            case NSStreamEventEndEncountered:
                break;
            case NSStreamEventErrorOccurred:
                break;
            default:
                break;
        }
    }
    else if (aStream == aOutputStream)
    {
        NSLog(@"ServerRelay aStream aOutputStream: %lu", (unsigned long)eventCode);
        switch (eventCode) {
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
    NSLog(@"ServerRelay accepted new Socket: host:%@ port:%hu", newSocket.connectedHost, (uint16_t)newSocket.connectedPort);
}

-(void)socket:(GCDAsyncSocket *)sock didConnectToHost:(NSString *)host port:(uint16_t)port
{
    NSLog(@"ServerRelay connected! socket:%p host:%@ port:%hu", sock, host, port);
    
    [sock readDataWithTimeout:-1 tag:0];
}

-(void)socketDidDisconnect:(GCDAsyncSocket *)sock withError:(NSError *)err
{
    NSLog(@"ServerRelay socketDidDisconnect");
    if (err) {
        NSLog(@"ServerRelay socket error '%@' on host:%@:%u", err, sock.connectedHost, sock.connectedPort);
    }
}

-(void)socket:(GCDAsyncSocket *)sock didWriteDataWithTag:(long)tag
{
    NSLog(@"ServerRelay didWriteDataWithTag:%ld", tag);
}

-(void)socket:(GCDAsyncSocket *)sock didReadData:(NSData *)data withTag:(long)tag
{
    NSString *str = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    NSLog(@"ServerRelay didReadDataWithTag:%ld %@", tag, str);
    
    [aOutputStream write:data.bytes maxLength:data.length];
    [aSocket readDataWithTimeout:-1 tag:tag];
}



@end
