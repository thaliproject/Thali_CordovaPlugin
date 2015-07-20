
#import "THENetworkingClientRelay.h"

@implementation THENetworkingClientRelay
{
@private
    NSInputStream *aInputStream;
    NSOutputStream *aOutputStream;
    uint aPort;
}

-(instancetype)initWithMPInputStream:(NSInputStream *)inputStream
                  withMPOutputStream:(NSOutputStream *)outputStream
                            withPort:(uint)port
{
    if (!self) {
        
        aInputStream = inputStream;
        aOutputStream = outputStream;
        aPort = port;
    }
    return self;
}

-(BOOL)start
{
    if (aInputStream != nil && aOutputStream != nil) {
        // check is open...
        
        aInputStream.delegate = self;
        [aInputStream scheduleInRunLoop:[NSRunLoop mainRunLoop] forMode:NSDefaultRunLoopMode];
        [aInputStream open];
        
        aOutputStream.delegate = self;
        [aOutputStream scheduleInRunLoop:[NSRunLoop mainRunLoop] forMode:NSDefaultRunLoopMode];
        [aOutputStream open];
        
        asyncSocket = [[GCDAsyncSocket alloc] initWithDelegate:self delegateQueue:dispatch_get_main_queue()];
        
        NSError *err = nil;
        if (![asyncSocket connectToHost:@"localhost" onPort:aPort withTimeout:-1 error:&err])
        {
            NSLog(@"Client relay setup error on port:%u %@", aPort, err);
            return NO;
        }
        else
        {
            NSData *data = [@"World" dataUsingEncoding:NSUTF8StringEncoding];
            [asyncSocket writeData:data withTimeout:-1 tag:1];
            [asyncSocket readDataToData:data withTimeout:-1 tag:1];
            
            NSLog(@"Client relay data on port:%u data:%@", aPort, [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] );
            
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
        NSLog(@"Client relay aStream aInputStream");
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
    else if (aStream == aOutputStream)
    {
        NSLog(@"Client relay aStream aOutputStream");
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
    NSLog(@"Client relay accepted new Socket: host:%@ port:%hu", newSocket.connectedHost, (uint16_t)newSocket.connectedPort);
}

-(void)socket:(GCDAsyncSocket *)sock didConnectToHost:(NSString *)host port:(uint16_t)port
{
    NSLog(@"Client relay connected! socket:%p host:%@ port:%hu", sock, host, port);
    
    [sock readDataWithTimeout:-1 tag:0];
}

-(void)socketDidDisconnect:(GCDAsyncSocket *)sock withError:(NSError *)err
{
    NSLog(@"Client relay socketDidDisconnect");
    if (err) {
        NSLog(@"CR Socket Error: %@", err);
        // Error in connect function:
        // GCDAsyncSocketErrorDomain Code=7 "Socket closed by remote peer" (same device)
        // NSPOSIXErrorDomain Code=61 "Connection refused" (no listener setup)
    }
}

-(void)socket:(GCDAsyncSocket *)sock didWriteDataWithTag:(long)tag
{
    NSLog(@"Client relay didWriteDataWithTag:%ld", tag);
}

-(void)socket:(GCDAsyncSocket *)sock didReadData:(NSData *)data withTag:(long)tag
{
    NSString *str = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    NSLog(@"Client relay didReadDataWithTag:%ld %@", tag, str);
    
    // TODO: check for string equality
}



@end
