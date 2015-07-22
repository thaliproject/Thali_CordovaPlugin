
#import "THENetworkingServerRelay.h"

@implementation THENetworkingServerRelay
{
    @private
    NSInputStream *aInputStream;
    NSOutputStream *aOutputStream;
    uint aPort;
    GCDAsyncSocket *aSocket;
    NSUUID *aPeerIdentifier;
    
    pthread_mutex_t _mutex;
}

-(instancetype)initWithInputStream:(NSInputStream *)inputStream
                  withOutputStream:(NSOutputStream *)outputStream
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
            NSLog(@"ServerRelay setup error on port:%u %@", aPort, err);
            return NO;
        }
        else
        {
            UInt16 port = [asyncSocket localPort];
            NSLog(@"ServerRelay socket got localPort: %u ", port);
            
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
            {
                NSLog(@"aInputStream Stream Ended");
            }
                break;
            case NSStreamEventErrorOccurred:
            {
                NSLog(@"aInputStream Error");
            }
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
            {
                
            }
                break;
            case NSStreamEventHasBytesAvailable:
                break;
            case NSStreamEventEndEncountered:
            {
                NSLog(@"aOutputStream Stream Ended");
            }
                break;
            case NSStreamEventErrorOccurred:
            {
                NSLog(@"aOutputStream Error");
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
    NSLog(@"ServerRelay accepted new Socket: host:%@ port:%hu", newSocket.connectedHost, (uint16_t)newSocket.connectedPort); // newSocket client port
    
    aSocket = newSocket;
    
    //[aSocket writeData:[@"Hello" dataUsingEncoding:NSUTF8StringEncoding] withTimeout:-1 tag:0]; // needed
    //[aSocket readDataWithTimeout:-1 tag:1]; // NB: Inifinite timeouts will timeout after 10 mins
}

-(void)socketDidDisconnect:(GCDAsyncSocket *)sock withError:(NSError *)err
{
    NSLog(@"ServerRelay socketDidDisconnect");
    if (err) {
        NSLog(@"ServerRelay Socket Error: %@", [err description]);
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
    
    assert(sock == aSocket);
    
    // echo data back to client
    [aSocket writeData:data withTimeout:-1 tag:tag];
    [aSocket readDataWithTimeout:-1 tag:tag];
}



@end
