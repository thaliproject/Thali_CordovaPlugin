// 
#import "../../../GCDAsyncSocket/GCDAsyncSocket.h"

@interface TestEchoClient : NSObject <GCDAsyncSocketDelegate>

- (instancetype)initWithPort:(unsigned short)serverPort 
          withConnectHandler:(void (^)(void))connectHandler;
- (void)stop;

@end
