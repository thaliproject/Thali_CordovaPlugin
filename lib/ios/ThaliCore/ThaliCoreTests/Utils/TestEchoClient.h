//
//  TestEchoClient.h
//  ThaliCoreTests
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import "GCDAsyncSocket.h"

// Basic client for TestEchoServer
@interface TestEchoClient : NSObject <GCDAsyncSocketDelegate>

- (instancetype)initWithPort:(unsigned short)serverPort 
          withConnectHandler:(void (^)(void))connectHandler;

- (void)stop;
- (void)write:(NSData *)data;
- (void)setReadHandler:(void (^)(NSData *))readHandler;

@end
