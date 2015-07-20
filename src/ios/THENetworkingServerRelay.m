
#import "THENetworkingServerRelay.h"

@implementation THENetworkingServerRelay
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
        if (![asyncSocket acceptOnPort:aPort error:&err])
        {
            NSLog(@"Server relay setup error on port:%u %@", aPort, err);
            return NO;
        }
        else
        {
            UInt16 port = [asyncSocket localPort];
            NSLog(@"Server relay socket got localPort: %u", port);
            
            // Pass event didGetPort by notifing the delegate
            if ([[self delegate] respondsToSelector:@selector(networkingServerRelay:didGetLocalPort:)])
            {
                [[self delegate] networkingServerRelay:self didGetLocalPort:port];
            }
            
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
        NSLog(@"aStream aInputStream");
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
        NSLog(@"aStream aOutputStream");
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
    NSLog(@"listenerSocket accepted new Socket: host:%@ port:%hu", newSocket.connectedHost, (uint16_t)newSocket.connectedPort); // newSocket client port
    
    [newSocket writeData:[@"Hello" dataUsingEncoding:NSUTF8StringEncoding] withTimeout:-1 tag:1]; // needed
    
    [newSocket readDataWithTimeout:-1 tag:0];
}

-(void)socket:(GCDAsyncSocket *)sock didConnectToHost:(NSString *)host port:(uint16_t)port
{
    NSLog(@"listenerSocket Connected! socket:%p host:%@ port:%hu", sock, host, port);
}

-(void)socketDidDisconnect:(GCDAsyncSocket *)sock withError:(NSError *)err
{
    NSLog(@"listenerSocket socketDidDisconnect");
    if (err) {
        NSLog(@"listenerSocket Socket Error: %@", err);
    }
}

-(void)socket:(GCDAsyncSocket *)sock didWriteDataWithTag:(long)tag
{
    NSLog(@"listenerSocket didWriteDataWithTag:%ld", tag);
}

-(void)socket:(GCDAsyncSocket *)sock didReadData:(NSData *)data withTag:(long)tag
{
    NSString *str = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    NSLog(@"listenerSocket didReadDataWithTag:%ld %@", tag, str);
    
    [sock writeData:data withTimeout:-1 tag:tag];
    
    [sock readDataWithTimeout:-1 tag:tag];
}



@end
