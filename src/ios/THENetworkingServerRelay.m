
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
        switch (eventCode) {
            case NSStreamEventOpenCompleted:
                NSLog(@"<- ServerRelay aInputStream Opened");
                break;
            case NSStreamEventHasSpaceAvailable:
                break;
            case NSStreamEventHasBytesAvailable:
            {
                assert(aSocket);
                
                // Read from input stream, write to socket
                const uint bufferValue = 1024; // 512, 1024 or 4k
                
                uint8_t *buffer = malloc(bufferValue);
                
                NSInteger len = [aInputStream read:buffer maxLength:sizeof(bufferValue)];
                
                NSMutableData *toWrite = [[NSMutableData alloc] init];
                [toWrite appendBytes:buffer length:len];
                
                [aSocket writeData:toWrite withTimeout:-1 tag:0];
            }
                break;
            case NSStreamEventEndEncountered:
                NSLog(@"<- ServerRelay aInputStream Ended");
                break;
            case NSStreamEventErrorOccurred:
                NSLog(@"<- ServerRelay aInputStream Error!");
                break;
            default:
                break;
        }
    }
    else if (aStream == aOutputStream)
    {
        switch (eventCode) {
            case NSStreamEventOpenCompleted:
                NSLog(@"-> ServerRelay aOutputStream Opened");
                break;
            case NSStreamEventHasSpaceAvailable:
                break;
            case NSStreamEventHasBytesAvailable:
                break;
            case NSStreamEventEndEncountered:
                NSLog(@"-> ServerRelay aOutputStream Ended");
                break;
            case NSStreamEventErrorOccurred:
                NSLog(@"-> ServerRelay aOutputStream Error!");
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
    NSLog(@"ServerRelay connected! socket:%p host:%@ port:%hu", [sock localHost], host, port);
    
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
