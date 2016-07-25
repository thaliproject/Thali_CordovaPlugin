//
//  The MIT License (MIT)
//
//  Copyright (c) 2016 Microsoft
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//  THE SOFTWARE.
//
//  Thali CordovaPlugin
//  THETestRunner.m
//

#import <XCTest/XCTest.h>

#import "THETestRunner.h"
#import "THETestRun.h"
#import "THETestRunFailure.h"

@interface THETestRunner () <XCTestObservation>

// Dependencies

@property (strong, readonly) XCTestSuite *testSuite;
@property (strong, readonly) XCTestObservationCenter *testObservationCenter;

//

@property (strong, nullable) XCTestSuite *runningTestSuite;
@property (strong, nullable) XCTestCase *runningTestCase;
@property (strong, nullable) NSArray <THETestRunFailure *> *runningTestCaseFailures;

@property (strong, nullable) NSArray <THETestRun *> *testRuns;

//

- (instancetype)initWithTestSuite:(XCTestSuite *)testSuite
            testObservationCenter:(XCTestObservationCenter *)testObservationCenter;

@end

@implementation THETestRunner

@dynamic testRunResult;

#pragma mark - init / deinit

+ (instancetype)defaultRunner {
    static THETestRunner *runner = nil;
    static dispatch_once_t onceToken;

    dispatch_once(&onceToken, ^{
        runner = [[THETestRunner alloc] initWithTestSuite:[XCTestSuite defaultTestSuite]
                                    testObservationCenter:[XCTestObservationCenter sharedTestObservationCenter]];
    });

    return runner;
}

- (instancetype)initWithTestSuite:(XCTestSuite *)testSuite
            testObservationCenter:(XCTestObservationCenter *)testObservationCenter {
    self = [super init];
    if (self) {
        _testSuite = testSuite;
        _testObservationCenter = testObservationCenter;

        [_testObservationCenter addTestObserver:self];
    }
    return self;
}

- (void)dealloc {
    [_testObservationCenter removeTestObserver:self];
}

#pragma mark - Properties

- (THETestRunnerResult *)testRunResult {
    NSUInteger executedCount = self.testRuns.count;
    NSUInteger succeededCount = 0;
    NSUInteger failureCount = 0;
    NSUInteger duration = self.testSuite.testRun.totalDuration;

    for (THETestRun *run in self.testRuns) {

        if (run.failures.count != 0) {
            failureCount += 1;
        } else {
            succeededCount += 1;
        }
    }

    return [[THETestRunnerResult alloc] initWithExecutedCount:executedCount
                                               succeededCount:succeededCount
                                                 failureCount:failureCount
                                                     duration:duration];
}

#pragma mark -

- (void)runTest {
    [self.testSuite runTest];
}

#pragma mark - XCTestObservation

- (void)testBundleWillStart:(NSBundle *)testBundle {
}

- (void)testBundleDidFinish:(NSBundle *)testBundle {
}

- (void)testSuiteWillStart:(XCTestSuite *)testSuite {
    self.runningTestSuite = testSuite;
    self.testRuns = @[];
}

- (void)testSuite:(XCTestSuite *)testSuite didFailWithDescription:(NSString *)description inFile:(nullable NSString *)filePath atLine:(NSUInteger)lineNumber {
}

- (void)testSuiteDidFinish:(XCTestSuite *)testSuite {
    self.runningTestSuite = nil;
}

- (void)testCaseWillStart:(XCTestCase *)testCase {
    self.runningTestCase = testCase;
    self.runningTestCaseFailures = @[];
}

- (void)testCase:(XCTestCase *)testCase didFailWithDescription:(NSString *)description inFile:(nullable NSString *)filePath atLine:(NSUInteger)lineNumber {
    THETestRunFailure *runFailure = [[THETestRunFailure alloc] initWithFailureDescription:description
                                                                                 filePath:filePath
                                                                                     line:lineNumber];

    self.runningTestCaseFailures = [self.runningTestCaseFailures arrayByAddingObject:runFailure];
}

- (void)testCaseDidFinish:(XCTestCase *)testCase {
    NSString *runName = [NSString stringWithFormat:@"%@/%@", self.runningTestSuite.name, self.runningTestCase.name];
    
    THETestRun *testRun = [[THETestRun alloc] initWithName:runName
                                                  failures:self.runningTestCaseFailures];
    
    self.testRuns = [self.testRuns arrayByAddingObject:testRun];

    self.runningTestCase = nil;
    self.runningTestCaseFailures = nil;
}

@end
