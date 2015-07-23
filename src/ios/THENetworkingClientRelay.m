
#import "THENetworkingClientRelay.h"

@implementation THENetworkingClientRelay
{
    @private
    NSInputStream *aInputStream;
    NSOutputStream *aOutputStream;
//    uint aPort;
    NSUUID *aPeerIdentifier;
    GCDAsyncSocket *aSocket;
}

-(instancetype)initWithInputStream:(NSInputStream *)inputStream
                  withOutputStream:(NSOutputStream *)outputStream
//                          withPort:(uint)port
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
//    aPort = port;
    aPeerIdentifier = peerIdentifier;
    
    return self;
}

-(BOOL)start
{
    NSLog(@"**** start *****");
    if (aInputStream != nil && aOutputStream != nil) {
        // check is open...
        
        serverSocket = [[GCDAsyncSocket alloc] initWithDelegate:self delegateQueue:dispatch_get_main_queue()];
        
        NSError *err = nil;
        if (![serverSocket acceptOnPort:0 error:&err])
        {
            NSLog(@"ClientRelay setup error: %@", err);
            return NO;
        }
        else
        {
            UInt16 port = [serverSocket localPort];
            NSLog(@"ClientRelay socket got localPort: %u ", port);
            
            // Pass event didGetPort by notifing the delegate
            if ([[self delegate] respondsToSelector:@selector(networkingClientRelay:didGetLocalPort:withPeerIdentifier:)])
            {
                [[self delegate] networkingClientRelay:self didGetLocalPort:port withPeerIdentifier:aPeerIdentifier];
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
        //NSLog(@"ClientRelay aStream aInputStream: %lu", (unsigned long)eventCode);
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
                
                NSInteger len = [aInputStream read:buffer maxLength:bufferSize];
                
                NSMutableData *toWrite = [[NSMutableData alloc] init];//[[NSData alloc] initWithBytesNoCopy:buffer length:bufferSize];
                [toWrite appendBytes:buffer length:len];
                
                
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
        NSLog(@"ClientRelay aStream aOutputStream: %lu", (unsigned long)eventCode);
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
    NSLog(@"ClientRelay accepted new Socket: host:%@ port:%hu", newSocket.connectedHost, (uint16_t)newSocket.connectedPort); // newSocket client port
    
    aSocket = newSocket;
    
    aInputStream.delegate = self;
    [aInputStream scheduleInRunLoop:[NSRunLoop mainRunLoop] forMode:NSDefaultRunLoopMode];
    [aInputStream open];
    
    aOutputStream.delegate = self;
    [aOutputStream scheduleInRunLoop:[NSRunLoop mainRunLoop] forMode:NSDefaultRunLoopMode];
    [aOutputStream open];
    
    //[aSocket writeData:[@"Hello" dataUsingEncoding:NSUTF8StringEncoding] withTimeout:-1 tag:0]; // needed
    [aSocket readDataWithTimeout:-1 tag:1]; // NB: Inifinite timeouts will timeout after 10 mins
}

-(void)socketDidDisconnect:(GCDAsyncSocket *)sock withError:(NSError *)err
{
    NSLog(@"ClientRelay socketDidDisconnect");
    if (err) {
        NSLog(@"ClientRelay Socket Error: %@", [err description]);
    }
}

-(void)socket:(GCDAsyncSocket *)sock didWriteDataWithTag:(long)tag
{
    NSLog(@"ClientRelay didWriteDataWithTag:%ld", tag);
}

-(void)socket:(GCDAsyncSocket *)sock didReadData:(NSData *)data withTag:(long)tag
{
    NSString *str = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    NSLog(@"ClientRelay didReadDataWithTag:%ld %@", tag, str);
    
    assert(sock == aSocket);
    
    // echo data back to client
    //[aSocket writeData:data withTimeout:-1 tag:tag];
    
    [aOutputStream write:data.bytes maxLength:data.length];
    [aSocket readDataWithTimeout:-1 tag:tag];
}



@end
