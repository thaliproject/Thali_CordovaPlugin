//
//  TestEchoServer.h
//  ThaliCoreTests
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import "GCDAsyncSocket.h"

// Simple TCP Echo Server - This'll be the 'app' we're using in the tests

@interface TestEchoServer : NSObject <GCDAsyncSocketDelegate>
- (BOOL)start:(unsigned short)port;
- (BOOL)stop;
@end
