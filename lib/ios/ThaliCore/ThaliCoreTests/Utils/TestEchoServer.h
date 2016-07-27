// Simple TCP Echo Server - This'll be the 'app' we're using in the tests

#import "GCDAsyncSocket.h"

@interface TestEchoServer : NSObject <GCDAsyncSocketDelegate>
- (BOOL)start:(unsigned short)port;
- (BOOL)stop;
@end
