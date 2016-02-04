//
//  ThaliMultiipleInstanceTests.m
//  Thali
//
//  Created by tobe on 23/01/2016.
//  Copyright © 2016 Microsoft. All rights reserved.
//

#import <XCTest/XCTest.h>
#import "TestEchoClient.h"
#import "TestEchoServer.h"
#import "../../../MultipeerConnectivity/THEMultipeerManager.h"

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
  
  // Expect to have data written echoed back
  NSMutableData *receiveBuffer = [[NSMutableData alloc] init];
  NSData *toSend = [[[[NSUUID alloc]init] UUIDString] dataUsingEncoding:NSUTF8StringEncoding];
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
  
  // Expect to have data written echoed back
  NSMutableData *receiveBuffer = [[NSMutableData alloc] init];
  NSData *toSend = [[[[NSUUID alloc]init] UUIDString] dataUsingEncoding:NSUTF8StringEncoding];
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

@end
