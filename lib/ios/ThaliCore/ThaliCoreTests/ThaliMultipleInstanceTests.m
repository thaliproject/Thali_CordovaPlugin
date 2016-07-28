//
//  ThaliMultiipleInstanceTests.m
//  ThaliCoreTests
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <XCTest/XCTest.h>
#import <ThaliCore/ThaliCore.h>

#import "TestEchoClient.h"
#import "TestEchoServer.h"

@interface THETestDiscoveryEventHandler : NSObject <THEPeerDiscoveryDelegate>
{
  // Implement the THEPeerDiscoverDelegate in a way that makes it easy for tests
  // to supply blocks as event handlers.

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

@interface THETestRemoteConnectionEventHandler : NSObject <THERemoteConnectionDelegate>
{
  // Implement the THEPeerDiscoverDelegate in a way that makes it easy for tests
  // to supply blocks as event handlers.

@public
  void (^_onConnectionFailed)(unsigned short);
}
@end

@implementation THETestRemoteConnectionEventHandler

- (void)didNotAcceptConnectionWithServerPort:(unsigned short)serverPort
{
  if (_onConnectionFailed)
  {
    _onConnectionFailed(serverPort);
  }
}

@end

// The Tests
/////////////

@interface ThaliMultipleInstanceTests : XCTestCase
@end

@implementation ThaliMultipleInstanceTests
{
  THEMultipeerManager *_app1;
  THEMultipeerManager *_app2;
  
  THETestDiscoveryEventHandler *_app1Handler;
  THETestDiscoveryEventHandler *_app2Handler;
  
  THETestRemoteConnectionEventHandler *_app1ConnectionHandler;
  THETestRemoteConnectionEventHandler *_app2ConnectionHandler;
}

static double _baseUUID = 0;
static const int DEFAULT_EXPECT_TIMEOUT = 30.0;

- (void)setUp
{
  [super setUp];

  if (!_baseUUID)
  {
    _baseUUID = [[NSDate date] timeIntervalSince1970];
  }
  
  // UUID1 < UUID2, always.
  NSString *uuid1 = [[[NSNumber alloc] initWithDouble:++_baseUUID] stringValue];
  NSString *uuid2 = [[[NSNumber alloc] initWithDouble:++_baseUUID] stringValue];
  
  _app1Handler = [[THETestDiscoveryEventHandler alloc] init];
  _app1ConnectionHandler = [[THETestRemoteConnectionEventHandler alloc] init];
  
  _app1 = [[THEMultipeerManager alloc] initWithServiceType:@"THALITEST"
                                        withPeerIdentifier:uuid1
                                 withPeerDiscoveryDelegate:_app1Handler
                              withRemoteConnectionDelegate:_app1ConnectionHandler];

  _app2Handler = [[THETestDiscoveryEventHandler alloc] init];
  _app2ConnectionHandler = [[THETestRemoteConnectionEventHandler alloc] init];

  _app2 = [[THEMultipeerManager alloc] initWithServiceType:@"THALITEST"
                                        withPeerIdentifier:uuid2
                                 withPeerDiscoveryDelegate:_app2Handler
                              withRemoteConnectionDelegate:_app2ConnectionHandler];
}

- (void)tearDown {
  _app2Handler = nil;
  _app1Handler = nil;
  
  _app2 = nil;
  _app1 = nil;
  [super tearDown];
}

- (void)testEchoClient
{
  TestEchoServer *echoServer = [[TestEchoServer alloc] init];
  XCTAssertTrue([echoServer start:4040]);

  XCTestExpectation *connectExpectation = [self expectationWithDescription:@"connected to echo server"];
  TestEchoClient *echoClient = [[TestEchoClient alloc] initWithPort:4040 withConnectHandler: ^void(void) {
      [connectExpectation fulfill];
  }];
  
  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
  if (error) {
    XCTFail(@"Expectation Failed with error: %@", error);
  }
  }];
  
  NSMutableData *toSend = [[NSMutableData alloc] initWithLength:10 * 1024 * 1024];
  NSMutableData *receiveBuffer = [[NSMutableData alloc] init];
  XCTestExpectation *receiveExpectation = [self expectationWithDescription:@"connected to echo server"];
  
  [echoClient setReadHandler: ^void(NSData *data) {
    [receiveBuffer appendBytes:data.bytes length:data.length];
    if ([receiveBuffer length] == [toSend length]) {
      [receiveExpectation fulfill];
    }
  }];

  [echoClient write:toSend];
  
  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];
}

- (void)testPeerAvailabilityChangedIsCalled
{
  [_app1 startListening];
  [_app2 startServerWithServerPort:4242];
  
  // Simple check that peers are discovered
  
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
  
  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
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
  
  // app2 > app1 therefore app2 can only connect to app1 via a forward connection
  
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
  
  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
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
  

  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
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
  
  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
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
  

  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
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

- (void)testMutateBeacons
{
  // Check we can make connections when the server is changing it's id

  TestEchoServer *echoServer1 = [[TestEchoServer alloc] init];
  XCTAssertTrue([echoServer1 start:4141]);

  TestEchoServer *echoServer2 = [[TestEchoServer alloc] init];
  XCTAssertTrue([echoServer2 start:4242]);
  
  // app2 > app1 therefore app2 can only connect to app1 via a forward connection

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
  
  [_app1 startListening];
  [_app1 startServerWithServerPort:4141];
  
  [_app2 startListening];
  [_app2 startServerWithServerPort:4242];

  // Straightforward case of app2 connecting to app1

  
  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];


  // Set up the next handler
  
  clientPeer = nil;
  clientExpectation = [self expectationWithDescription:@"client peerAvailabilityHandler is called"];
  _app2Handler->_didFindPeerHandler = ^void(NSDictionary *p)
  {
    // Should be rediscovered..
    if ([p[@"peerIdentifier"] isEqual: [weakApp1 localPeerIdentifier]])
    {
      clientPeer = p;
      [clientExpectation fulfill];
    }
  };


  // app1 changes it's id
  [_app1 startServerWithServerPort:4242];


  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
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
  

  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
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

- (void)testConnectToOldBeaconFails
{
  // Check we can make connections when the server is changing it's id

  TestEchoServer *echoServer1 = [[TestEchoServer alloc] init];
  XCTAssertTrue([echoServer1 start:4141]);

  TestEchoServer *echoServer2 = [[TestEchoServer alloc] init];
  XCTAssertTrue([echoServer2 start:4242]);
  
  // app2 > app1 therefore app2 can only connect to app1 via a forward connection

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
  
  [_app1 startListening];
  [_app1 startServerWithServerPort:4141];
  
  [_app2 startListening];
  [_app2 startServerWithServerPort:4242];

  // Straightforward case of app2 connecting to app1

  
  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];


  // app1 changes it's id
  [_app1 startServerWithServerPort:4242];


  // Now start the connection to old identifier..
  __block NSString *clientConnectError;
  __block NSDictionary *clientConnectDetails;
  XCTestExpectation *connectExpectation = [self expectationWithDescription:@"connect should succeed"];
  [_app2 connectToPeerWithPeerIdentifier:clientPeer[@"peerIdentifier"]
                    withConnectCallback:^void(NSString *error, NSDictionary *connection)
    {
      // We expect this connection to fail !!
      
      clientConnectError = error;
      clientConnectDetails = connection;
      if (clientConnectError) {
        [connectExpectation fulfill];
    }
  }];
  
  // The expectation shouldn't fail (since it depends on receiving a connect error)
  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];

  [echoServer2 stop];
  [echoServer1 stop];
}

- (void)testCanSendDataForwards
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
  
  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
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
  

  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];

  // We should now be able to send data over the new connection
  
  // Connect to the local server
  unsigned short serverPort = [clientConnectDetails[@"listeningPort"] intValue];
  XCTestExpectation *clientConnectExpectation = [self expectationWithDescription:@"client connect should succeed"];

  TestEchoClient *client = [[TestEchoClient alloc]
    initWithPort:serverPort withConnectHandler:^void(void) {
      [clientConnectExpectation fulfill];
  }];
  
  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];

  // Send 10 MB
  const int BUF_SIZE = 10 * 1024 * 1024;
  NSMutableData *toSend = [[NSMutableData alloc] initWithCapacity:BUF_SIZE];
  while ([toSend length] < BUF_SIZE) {
    [toSend appendData:[[[[NSUUID alloc] init] UUIDString] dataUsingEncoding:NSUTF8StringEncoding]];
  }
  
  // Expect to have data written echoed back
  NSMutableData *receiveBuffer = [[NSMutableData alloc] init];
  XCTestExpectation *receiveExpectation = [self expectationWithDescription:@"client receives it's data"];
  [client setReadHandler: ^void(NSData *data) {
      [receiveBuffer appendBytes:[data bytes] length:[data length]];
      if ([receiveBuffer length] == [toSend length]) {
        [receiveExpectation fulfill];
      }
  }];
  
  [client write:toSend];

  [self waitForExpectationsWithTimeout:600 handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];

  // Check we got what we send
  XCTAssertTrue([toSend isEqualToData:receiveBuffer]);
}


- (void)testCanSendDataBackwards
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
  
  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
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
  

  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];


  // Connect to the local server on *app2*
  unsigned short serverPort = [serverConnectDetails[@"listeningPort"] intValue];
  XCTestExpectation *serverConnectExpectation = [self expectationWithDescription:@"client connect should succeed"];

  TestEchoClient *client = [[TestEchoClient alloc]
    initWithPort:serverPort withConnectHandler:^void(void) {
      [serverConnectExpectation fulfill];
  }];
  
  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];
  
  // Send 10 MB
  const int BUF_SIZE = 10 * 1024 * 1024;
  NSMutableData *toSend = [[NSMutableData alloc] initWithCapacity:BUF_SIZE];
  while ([toSend length] < BUF_SIZE) {
    [toSend appendData:[[[[NSUUID alloc] init] UUIDString] dataUsingEncoding:NSUTF8StringEncoding]];
  }

  // Expect to have data written echoed back
  NSMutableData *receiveBuffer = [[NSMutableData alloc] init];
  XCTestExpectation *receiveExpectation = [self expectationWithDescription:@"client receives it's data"];
  [client setReadHandler: ^void(NSData *data) {
      [receiveBuffer appendBytes:[data bytes] length:[data length]];
      if ([receiveBuffer length] == [toSend length]) {
        [receiveExpectation fulfill];
      }
  }];
  
  [client write:toSend];

  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];

  // Check we got what we send
  XCTAssertTrue([toSend isEqualToData:receiveBuffer]);
  
  [echoServer2 stop];
  [echoServer1 stop];
}

- (void)testFailedServerConnection
{
  // app2 > app1 therefore app1 can only connect to app2 via a reverse connection

  [_app1 startListening];
  [_app1 startServerWithServerPort:4141];
  
  [_app2 startListening];
  [_app2 startServerWithServerPort:4242];

  // First, we wait for app2 to discover app1
  
  __block NSDictionary *clientPeer = nil;
  XCTestExpectation *clientExpectation = [self expectationWithDescription:@"client peerAvailabilityHandler is called"];
  
  __weak THEMultipeerManager *weakApp1 = _app1;
  _app2Handler->_didFindPeerHandler = ^void(NSDictionary *p)
  {
    // Screen out the ghosts (dead sessions still floating around the ether)
    if ([p[@"peerIdentifier"] isEqual: [weakApp1 localPeerIdentifier]])
    {
      clientPeer = p;
      [clientExpectation fulfill];
    }
  };
  
  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];
  
  // Now start the connection, it will succeed (but will fail quickly)
  // and app1 (the server) will get a callback

  XCTestExpectation *callbackExpectation = [self expectationWithDescription:@"server should get failed connect callback"];
  _app1ConnectionHandler->_onConnectionFailed = ^(unsigned short serverPort)
  {
    [callbackExpectation fulfill];
  };
  
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
  

  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];
}

- (void)testReverseConnectionsTimeout
{
  // Have _app1 request a reverse connection that never comes, we should correctly timeout
  
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
  
  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];
  
  _app1Handler->_didFindPeerHandler = nil;
  
  // Now have app2 change it's generation id
  [_app2 stopServer];
  [_app2 startServerWithServerPort:4242];

  // Have app1 attempt to connect to the old app2
  __block NSString *clientConnectError;
  __block NSDictionary *clientConnectDetails;
  XCTestExpectation *connectExpectation = [self expectationWithDescription:@"connect should succeed"];
  [_app1 connectToPeerWithPeerIdentifier:clientPeer[@"peerIdentifier"]
                    withConnectCallback:^void(NSString *error, NSDictionary *connection)
    {
      // We expect the connection to have timed out (since we attempted to connect to a previous
      // generation)
      clientConnectError = error;
      clientConnectDetails = connection;
      [connectExpectation fulfill];
    }
  ];
  
  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];
  
  XCTAssertTrue(clientConnectError != nil);
}

- (void)testExistingServerSessionIsReturnedCorrectly
{
  // In order for a server to succesfully complete a connection we *MUST* have
  // a listening application
  TestEchoServer *echoServer = [[TestEchoServer alloc] init];
  XCTAssertTrue([echoServer start:4141]);

  // First, we wait for app1 to discover app2
  
  XCTestExpectation *app1DiscoveryExpectation = [self expectationWithDescription:@"app1 discovers app2"];
  
  __block NSDictionary *app2Peer = nil;
  __weak THEMultipeerManager *weakApp2 = _app2;
  _app1Handler->_didFindPeerHandler = ^void(NSDictionary *p)
  {
    // Screen out the ghosts (dead sessions still floating around the ether)
    if ([p[@"peerIdentifier"] isEqual: [weakApp2 localPeerIdentifier]])
    {
      app2Peer = p;
      [app1DiscoveryExpectation fulfill];
    }
  };

  // .. and for app2 to discover app1
  XCTestExpectation *app2DiscoveryExpectation = [self expectationWithDescription:@"app2 discovers app1"];

  __block NSDictionary *app1Peer = nil;
  __weak THEMultipeerManager *weakApp1 = _app1;
  _app2Handler->_didFindPeerHandler = ^void(NSDictionary *p)
  {
    // Screen out the ghosts (dead sessions still floating around the ether)
    if ([p[@"peerIdentifier"] isEqual: [weakApp1 localPeerIdentifier]])
    {
      app1Peer = p;
      [app2DiscoveryExpectation fulfill];
    }
  };

  [_app1 startListening];
  [_app1 startServerWithServerPort:4141];
  
  [_app2 startListening];
  [_app2 startServerWithServerPort:4242];
  
  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];
  
  _app1Handler->_didFindPeerHandler = nil;
  _app2Handler->_didFindPeerHandler = nil;
  
  // Both apps have discovered each other, now connect app2 to app1 (a forward connection for app2
  // that will create a server session on app1)

  XCTestExpectation *app2ConnectExpectation = [self expectationWithDescription:@"app2 connect should succeed"];
  [_app2 connectToPeerWithPeerIdentifier:app1Peer[@"peerIdentifier"]
                    withConnectCallback:^void(NSString *error, NSDictionary *connection)
    {
      [app2ConnectExpectation fulfill];
    }
  ];
  
  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];

  // Now connection app1 to app2, the existing server session should be returned
  __block NSString *app1ConnectionError = nil;
  __block NSDictionary *app1ConnectionDetails = nil;
  XCTestExpectation *app1ConnectExpectation = [self expectationWithDescription:@"app1 connect should succeed"];
  [_app1 connectToPeerWithPeerIdentifier:app2Peer[@"peerIdentifier"]
                    withConnectCallback:^void(NSString *error, NSDictionary *connection)
    {
      app1ConnectionError = error;
      app1ConnectionDetails = connection;
      [app1ConnectExpectation fulfill];
    }
  ];
  
  [self waitForExpectationsWithTimeout:DEFAULT_EXPECT_TIMEOUT handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];
  
  XCTAssertTrue(app1ConnectionError == nil, "Should be no connection error");
  XCTAssertTrue([app1ConnectionDetails[@"clientPort"] intValue] != 0);
  XCTAssertTrue([app1ConnectionDetails[@"serverPort"] intValue] != 0);
  XCTAssertTrue([app1ConnectionDetails[@"listeningPort"] intValue] == 0);
}

@end
