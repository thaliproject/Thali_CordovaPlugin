//
//  ThaliMultiipleInstanceTests.m
//  Thali
//
//  Created by tobe on 23/01/2016.
//  Copyright © 2016 Microsoft. All rights reserved.
//

#import <XCTest/XCTest.h>
#import "../../../GCDAsyncSocket/GCDAsyncSocket.h"
#import "../../../MultipeerConnectivity/THEMultipeerManager.h"

@interface TestEchoServer : NSObject <GCDAsyncSocketDelegate>
- (BOOL)start:(unsigned short)port;
- (BOOL)stop;
@end

@implementation TestEchoServer
{
  GCDAsyncSocket *_serverSocket;
  NSMutableArray<GCDAsyncSocket *> *_clientSockets;
}

- (BOOL)start:(unsigned short)port
{
  _clientSockets = [[NSMutableArray alloc] init];
  
  _serverSocket = [[GCDAsyncSocket alloc]
                    initWithDelegate:self
                       delegateQueue:dispatch_get_main_queue()];
  
  NSError *err;
  return [_serverSocket acceptOnPort:port error:&err];
}

- (BOOL)stop
{
  [_serverSocket setDelegate:nil];
  [_serverSocket disconnect];
  _serverSocket = nil;
  
  for (GCDAsyncSocket *sock in _clientSockets)
  {
    [sock setDelegate:nil];
    [sock disconnect];
  }
  
  return true;
}

- (void)socket:(GCDAsyncSocket *)sock didAcceptNewSocket:(GCDAsyncSocket *)acceptedSocket
{
  [_clientSockets addObject:acceptedSocket];
  //[acceptedSocket readDataWithTimeout:-1 tag:0];
}

- (void)socket:(GCDAsyncSocket *)sock didReadData:(NSData *)data withTag:(long)tag
{
  [sock writeData:data withTimeout:-1 tag:0];
}

@end

@interface THETestDiscoveryEventHandler : NSObject <THEPeerDiscoveryDelegate>
{
@public
  void (^_didFindPeerHandler)(NSDictionary *);
}
@end

@implementation THETestDiscoveryEventHandler

- (void)didFindPeer:(NSDictionary *)peer
{
  if (_didFindPeerHandler)
  {
    _didFindPeerHandler(peer);
  }
}

- (void)didLosePeer:(NSString *)peerIdentifier
{
}

@end

@interface ThaliMultipleInstanceTests : XCTestCase
@end

@implementation ThaliMultipleInstanceTests
{
  THEMultipeerManager *_app1;
  THEMultipeerManager *_app2;
  
  THETestDiscoveryEventHandler *_app1Handler;
  THETestDiscoveryEventHandler *_app2Handler;
}

static double _baseUUID = 0;

- (void)setUp
{
  [super setUp];

  if (!_baseUUID)
  {
    _baseUUID = [[NSDate date] timeIntervalSince1970];
  }
  
  NSString *uuid1 = [[[NSNumber alloc] initWithDouble:++_baseUUID] stringValue];
  NSString *uuid2 = [[[NSNumber alloc] initWithDouble:++_baseUUID] stringValue];
  
  _app1Handler = [[THETestDiscoveryEventHandler alloc] init];
  _app1 = [[THEMultipeerManager alloc] initWithServiceType:@"THALITEST"
                                        withPeerIdentifier:uuid1
                                 withPeerDiscoveryDelegate:_app1Handler];

  _app2Handler = [[THETestDiscoveryEventHandler alloc] init];
  _app2 = [[THEMultipeerManager alloc] initWithServiceType:@"THALITEST"
                                        withPeerIdentifier:uuid2
                                 withPeerDiscoveryDelegate:_app2Handler];
}

- (void)tearDown {
  _app2Handler = nil;
  _app1Handler = nil;
  
  _app2 = nil;
  _app1 = nil;
  [super tearDown];
}

- (void)testPeerAvailabilityChangedIsCalled
{
  [_app1 startListening];
  [_app2 startServerWithServerPort:4242];
  
  __block NSDictionary *clientPeer = nil;
  __weak THEMultipeerManager *weakApp2 = _app2;
  XCTestExpectation *clientExpectation = [self expectationWithDescription:@"client peerAvailabilityHandler is called"];

  _app1Handler->_didFindPeerHandler = ^void(NSDictionary *p)
  {
    if ([p[@"peerIdentifier"] isEqual: [weakApp2 localPeerIdentifier]])
    {
      clientPeer = p;
      [clientExpectation fulfill];
    }
  };
  
  [self waitForExpectationsWithTimeout:5.0 handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];
  
  XCTAssertTrue([clientPeer objectForKey:@"peerIdentifier"] != nil);
  XCTAssertTrue([clientPeer objectForKey:@"peerAvailable"] != nil);
  XCTAssertTrue([clientPeer objectForKey:@"peerAvailable"]);
  XCTAssertTrue([clientPeer objectForKey:@"pleaseConnect"] != nil);
}

- (void)testCanForwardConnectToPeer
{
  TestEchoServer *echoServer1 = [[TestEchoServer alloc] init];
  XCTAssertTrue([echoServer1 start:4141]);

  TestEchoServer *echoServer2 = [[TestEchoServer alloc] init];
  XCTAssertTrue([echoServer2 start:4242]);
  
  // app2 > app1 therefore app2 can only connect to app2 via a forward connection
  
  [_app1 startListening];
  [_app1 startServerWithServerPort:4141];
  
  [_app2 startListening];
  [_app2 startServerWithServerPort:4242];

  // Straightforward case of app2 connecting to app1

  // First wait for app2 to discover app1
  
  __block NSDictionary *clientPeer = nil;
  __weak THEMultipeerManager *weakApp1 = _app1;
  XCTestExpectation *clientExpectation = [self expectationWithDescription:@"client peerAvailabilityHandler is called"];
  _app2Handler->_didFindPeerHandler = ^void(NSDictionary *p)
  {
    if ([p[@"peerIdentifier"] isEqual: [weakApp1 localPeerIdentifier]])
    {
      clientPeer = p;
      [clientExpectation fulfill];
    }
  };
  
  [self waitForExpectationsWithTimeout:5.0 handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];

  // Now start the connection..
  __block NSString *clientConnectError;
  __block NSDictionary *clientConnectDetails;
  XCTestExpectation *connectExpectation = [self expectationWithDescription:@"connect should succeed"];
  [_app2 connectToPeerWithPeerIdentifier:clientPeer[@"peerIdentifier"]
                    withConnectCallback:^void(NSString *error, NSDictionary *connection)
    {
      clientConnectError = error;
      clientConnectDetails = connection;
      if (clientConnectDetails) {
        [connectExpectation fulfill];
    }
  }];
  

  [self waitForExpectationsWithTimeout:5.0 handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];

  // This should have been a forward connection, check details match
  
  XCTAssertTrue(clientConnectDetails[@"listeningPort"] != nil);
  XCTAssertTrue([clientConnectDetails[@"listeningPort"] isKindOfClass:[NSNumber class]]);
  XCTAssertTrue([[clientConnectDetails objectForKey:@"listeningPort"] intValue] != 0);
  
  XCTAssertTrue(clientConnectDetails[@"clientPort"] != nil);
  XCTAssertTrue([clientConnectDetails[@"clientPort"] isKindOfClass:[NSNumber class]]);
  XCTAssertTrue([clientConnectDetails[@"clientPort"] intValue] == 0);
  
  XCTAssertTrue(clientConnectDetails[@"serverPort"] != nil);
  XCTAssertTrue([clientConnectDetails[@"serverPort"] isKindOfClass:[NSNumber class]]);
  XCTAssertTrue([clientConnectDetails[@"serverPort"] intValue] == 0);
  
  [echoServer2 stop];
  [echoServer1 stop];
}

- (void)testCanReverseConnectToPeer
{
  TestEchoServer *echoServer1 = [[TestEchoServer alloc] init];
  XCTAssertTrue([echoServer1 start:4141]);

  TestEchoServer *echoServer2 = [[TestEchoServer alloc] init];
  XCTAssertTrue([echoServer2 start:4242]);
  
  // app2 > app1 therefore app1 can only connect to app2 via a reverse connection
  
  [_app1 startListening];
  [_app1 startServerWithServerPort:4141];
  
  [_app2 startListening];
  [_app2 startServerWithServerPort:4242];

  // First, we wait for app1 to discover app2
  
  __block NSDictionary *clientPeer = nil;
  XCTestExpectation *clientExpectation = [self expectationWithDescription:@"client peerAvailabilityHandler is called"];
  
  __weak THEMultipeerManager *weakApp2 = _app2;
  _app1Handler->_didFindPeerHandler = ^void(NSDictionary *p)
  {
    // Screen out the ghosts (dead sessions still floating around the ether)
    if ([p[@"peerIdentifier"] isEqual: [weakApp2 localPeerIdentifier]])
    {
      clientPeer = p;
      [clientExpectation fulfill];
    }
  };
  
  [self waitForExpectationsWithTimeout:5.0 handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];
  

  // Next we will tell app1 to connect to app2, since app1 < app2 this will force a reverse
  // connection i.e. app2 will see the invite from app1 and reject it but signal to user land
  // that a connection is being requested via pleaseConnect in the peerAvailibility event
  // User code receiving that event will then initiate the reverse connection.
  
  __block NSString *serverConnectError;
  __block NSDictionary *serverPeer = nil;
  __block NSDictionary *serverConnectDetails = nil;

  // Set up the handler user-land handler for app2 to process the connect request
  
  __weak THEMultipeerManager *weakApp1 = _app1;
  XCTestExpectation *serverExpectation = [self expectationWithDescription:@"server peerAvailabilityHandler is called"];
  _app2Handler->_didFindPeerHandler = ^void(NSDictionary *p)
  {
    if ([p[@"peerIdentifier"] isEqual: [weakApp1 localPeerIdentifier]])
    {
      serverPeer = p;
      if ([(NSNumber *)serverPeer[@"pleaseConnect"] compare:@YES] == NSOrderedSame)
      {
        [weakApp2 connectToPeerWithPeerIdentifier:serverPeer[@"peerIdentifier"]
          withConnectCallback:^void(NSString *error, NSDictionary *connection) {
            serverConnectError = error;
            serverConnectDetails = connection;
            if (serverConnectDetails) {
              [serverExpectation fulfill];
            }
          }
        ];
      }
    }
  };

  // Start the process by having app1 request connect to app2. Once the reverse connection is
  // established we expect our connectCallback to be called in the normal manner, albeit with
  // a different set of parameters.
  
  __block NSString *clientConnectError;
  __block NSDictionary *clientConnectDetails;
  XCTestExpectation *connectExpectation = [self expectationWithDescription:@"connect should succeed"];
  [_app1 connectToPeerWithPeerIdentifier:clientPeer[@"peerIdentifier"]
                    withConnectCallback:^void(NSString *error, NSDictionary *connection)
    {
      clientConnectError = error;
      clientConnectDetails = connection;
      if (clientConnectDetails) {
        [connectExpectation fulfill];
    }
  }];
  

  [self waitForExpectationsWithTimeout:5.0 handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];

  // This should have been a reverse connection, check the details are what we expect
  
  XCTAssertTrue(clientConnectDetails[@"listeningPort"] != nil);
  XCTAssertTrue([clientConnectDetails[@"listeningPort"] isKindOfClass:[NSNumber class]]);
  XCTAssertTrue([[clientConnectDetails objectForKey:@"listeningPort"] intValue] == 0);
  
  XCTAssertTrue(clientConnectDetails[@"clientPort"] != nil);
  XCTAssertTrue([clientConnectDetails[@"clientPort"] isKindOfClass:[NSNumber class]]);
  XCTAssertTrue([clientConnectDetails[@"clientPort"] intValue] != 0);
  
  XCTAssertTrue(clientConnectDetails[@"serverPort"] != nil);
  XCTAssertTrue([clientConnectDetails[@"serverPort"] isKindOfClass:[NSNumber class]]);
  XCTAssertTrue([clientConnectDetails[@"serverPort"] intValue] == 4141);
  
  [echoServer2 stop];
  [echoServer1 stop];
}


@end
