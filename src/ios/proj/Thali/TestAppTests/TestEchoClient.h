// Basic client for TestEchoServer

#import "../../../GCDAsyncSocket/GCDAsyncSocket.h"

@interface TestEchoClient : NSObject <GCDAsyncSocketDelegate>

- (instancetype)initWithPort:(unsigned short)serverPort 
          withConnectHandler:(void (^)(void))connectHandler;

- (void)stop;
- (void)write:(NSData *)data;
- (void)setReadHandler:(void (^)(NSData *))readHandler;

@end
