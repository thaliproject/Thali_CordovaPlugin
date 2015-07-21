
#import "THENetworkingServerRelay.h"

@implementation THENetworkingServerRelay
{
    @private
    NSInputStream *aInputStream;
    NSOutputStream *aOutputStream;
    uint aPort;
    NSUUID *aPeerIdentifier;
    
    pthread_mutex_t _mutex;
}

-(instancetype)initWithMPInputStream:(NSInputStream *)inputStream
                  withMPOutputStream:(NSOutputStream *)outputStream
                            withPort:(uint)port
                  withPeerIdentifier:(NSUUID *)peerIdentifier
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
    aPeerIdentifier = peerIdentifier;
    
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
            NSLog(@"Server relay socket got localPort: %u ", port);
            
            // Pass event didGetPort by notifing the delegate
            if ([[self delegate] respondsToSelector:@selector(networkingServerRelay:didGetLocalPort:withPeerIdentifier:)])
            {
                [[self delegate] networkingServerRelay:self didGetLocalPort:port withPeerIdentifier:aPeerIdentifier];
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
        NSLog(@"Server Relay aStream aInputStream: %lu", (unsigned long)eventCode);
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
        NSLog(@"Server Relay aStream aOutputStream: %lu", (unsigned long)eventCode);
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
    
    [newSocket writeData:[@"Hello" dataUsingEncoding:NSUTF8StringEncoding] withTimeout:-1 tag:0]; // needed
    
    [newSocket readDataWithTimeout:-1 tag:1]; // NB: Inifinite timeouts will timeout after 10 mins
}

-(void)socket:(GCDAsyncSocket *)sock didConnectToHost:(NSString *)host port:(uint16_t)port
{
    NSLog(@"listenerSocket Connected! socket:%p host:%@ port:%hu", sock, host, port);
}

-(void)socketDidDisconnect:(GCDAsyncSocket *)sock withError:(NSError *)err
{
    NSLog(@"listenerSocket socketDidDisconnect");
    if (err) {
        NSLog(@"listenerSocket Socket Error: %@", [err description]);
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
