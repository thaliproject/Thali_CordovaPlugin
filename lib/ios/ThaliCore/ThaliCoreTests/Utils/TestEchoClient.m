//
//  TestEchoClient.m
//  ThaliCoreTests
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import "TestEchoClient.h"

@implementation TestEchoClient
{
  GCDAsyncSocket *_socket;
  void (^_connectHandler)(void);
  void (^_readHandler)(NSData *);
}

- (instancetype)initWithPort:(unsigned short)serverPort
          withConnectHandler:(void (^)(void))connectHandler
{
  self = [super init];
  if (!self)
  {
    return nil;
  }

  _socket = [[GCDAsyncSocket alloc] 
                initWithDelegate:self
                   delegateQueue:dispatch_get_main_queue()];
  
  _connectHandler = connectHandler;
  [_socket connectToHost:@"127.0.0.1" onPort:serverPort error:nil];

  return self;
}

- (void)setReadHandler:(void (^)(NSData *))readHandler
{
  _readHandler = readHandler;
}

- (void)stop
{
  if (_socket)
  {
    [_socket disconnect];
    _socket = nil;
  }
}

- (void)write:(NSData *)data
{
  [_socket writeData:data withTimeout:-1 tag:0];
}

- (void)socket:(GCDAsyncSocket *)sock didConnectToHost:(NSString *)host port:(uint16_t)port
{
  [_socket readDataWithTimeout:-1 tag:0];

  if (_connectHandler)
  {
    _connectHandler();
  }
}

- (void)socket:(GCDAsyncSocket *)sock didReadData:(NSData *)data withTag:(long)tag
{
  if (_readHandler)
  {
    _readHandler(data);
  }
  [_socket readDataWithTimeout:-1 tag:0];
}

@end

