//
//  ThaliMultiipleInstanceTests.m
//  Thali
//
//  Created by tobe on 23/01/2016.
//  Copyright © 2016 Microsoft. All rights reserved.
//

#import <XCTest/XCTest.h>
#import "../../../THEAppContext.h"

@interface ThaliMultipleInstanceTests : XCTestCase <THEThaliEventDelegate>
@end

@implementation ThaliMultipleInstanceTests
{
  THEAppContext *_app1;
  THEAppContext *_app2;
  
  void (^_peerAvailabilityHandler)(NSString *);
}

- (void)networkChanged:(NSString *)json
{
}

- (void)appEnteredForeground
{
}

- (void)appEnteringBackground
{
}

- (void)peerAvailabilityChanged:(NSString *)peerJSON;
{
  if (_peerAvailabilityHandler)
  {
    _peerAvailabilityHandler(peerJSON);
  }
}

- (void)setUp
{
  [super setUp];
  _peerAvailabilityHandler = nil;
  _app1 = [[THEAppContext alloc] init];
  _app2 = [[THEAppContext alloc] init];
}

- (void)tearDown {
  _app2 = nil;
  _app1 = nil;
  [super tearDown];
}

- (void)testPeerAvailabilityChangedIsCalled
{
  [_app1 setThaliEventDelegate:self];
  [_app1 startListeningForAdvertisements];
  
  [_app2 startUpdateAdvertisingAndListening:4242];
  
  XCTestExpectation *expectation = [self expectationWithDescription:@"peerAvailabilityHandler is called"];
  
  __block NSObject *jsonObject = nil;
  _peerAvailabilityHandler = ^void(NSString *peerJSON)
  {
    NSData *peerData = [peerJSON dataUsingEncoding:NSUTF8StringEncoding];
    jsonObject = [NSJSONSerialization JSONObjectWithData:peerData
                                                options:kNilOptions
                                                  error:nil];
    [expectation fulfill];
  };
  
  [self waitForExpectationsWithTimeout:5.0 handler:^(NSError *error) {
    if (error)
    {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];
  
  XCTAssertTrue([jsonObject isKindOfClass:[NSArray class]]);
  NSArray *peerArray = (NSArray *)jsonObject;
  
  XCTAssertTrue([peerArray count] == 1);
  XCTAssertTrue([peerArray[0] isKindOfClass:[NSDictionary class]]);
  
  NSDictionary *peer = (NSDictionary *)peerArray[0];
  XCTAssertTrue([peer objectForKey:@"peerIdentifier"] != nil);
  XCTAssertTrue([peer objectForKey:@"peerAvailable"] != nil);
  XCTAssertTrue([peer objectForKey:@"peerAvailable"]);
  XCTAssertTrue([peer objectForKey:@"pleaseConnect"] != nil);
}

- (void)testCanConnectToPeer
{
  // Ensure _app1 and _app2 sort consistently between runs
  [_app1 setPeerIdentifier:@"A"];
  [_app2 setPeerIdentifier:@"B"];
  
  [_app1 setThaliEventDelegate:self];
  [_app1 startListeningForAdvertisements];
  
  [_app2 startUpdateAdvertisingAndListening:4242];
  
  XCTestExpectation *expectation;
  
  __block NSDictionary *peer = nil;
  expectation = [self expectationWithDescription:@"peerAvailabilityHandler is called"];
  _peerAvailabilityHandler = ^void(NSString *peerJSON)
  {
    NSData *peerData = [peerJSON dataUsingEncoding:NSUTF8StringEncoding];
    peer = (NSDictionary *)((NSArray *)[NSJSONSerialization JSONObjectWithData:peerData
                                                options:kNilOptions
                                                  error:nil])[0];
    [expectation fulfill];
  };
  
  [self waitForExpectationsWithTimeout:5.0 handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];
  
  expectation = [self expectationWithDescription:@"connectCallback is called"];
  [_app1 connectToPeer:peer[@"peerIdentifier"] connectCallback:^void(NSString *error, NSString *connection) {
    [expectation fulfill];
  }];

  [self waitForExpectationsWithTimeout:5.0 handler:^(NSError *error) {
    if (error) {
      XCTFail(@"Expectation Failed with error: %@", error);
    }
  }];
}

@end
