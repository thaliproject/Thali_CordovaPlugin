//
//  TestAppTests.m
//  ThaliCoreTests
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <XCTest/XCTest.h>
#import <ThaliCore/ThaliCore.h>

@interface ThaliSingleInstanceTests : XCTestCase
@end

@implementation ThaliSingleInstanceTests
{
  THEAppContext *_app;
}

- (void)setUp {
    [super setUp];
    _app = [[THEAppContext alloc] init];
}

- (void)tearDown {
    // Put teardown code here. This method is called after the invocation of each test method in the class.
    [super tearDown];
    _app = nil;
}

- (void)testCanStartListening {
  XCTAssertTrue([_app startListeningForAdvertisements]);
}

- (void)testStartListeningTwiceIsAnError {
  XCTAssertTrue([_app startListeningForAdvertisements]);
  XCTAssertFalse([_app startListeningForAdvertisements]);
}

- (void)testStopListeningIsNotAnError {
  XCTAssertTrue([_app stopListeningForAdvertisements]);
}

- (void)testStartAdvertising {
  XCTAssertTrue([_app startUpdateAdvertisingAndListening:4242]);
}

- (void)testStopAdvertisingIsNotAnError {
  XCTAssertTrue([_app stopAdvertisingAndListening]);
}

- (void)testStartAdvertisingTwiceIsNotAnError {
  XCTAssertTrue([_app startUpdateAdvertisingAndListening:4242]);
  XCTAssertTrue([_app startUpdateAdvertisingAndListening:4242]);
}

- (void)testInviteContextLength {
  NSString *uuid = [NSString stringWithFormat:@"%@:%llu", [[[NSUUID alloc] init] UUIDString], ULLONG_MAX];

  NSString *contextString = [NSString stringWithFormat:@"%@+%@", uuid, uuid];
  NSData *contextData = [contextString dataUsingEncoding:NSUTF8StringEncoding];
  XCTAssertTrue([contextData length] == 115);
}


@end
