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
//  THETestRunnerResult.m
//

#import "THETestRunnerResult.h"

@implementation THETestRunnerResult

@dynamic jsonString;

- (instancetype)initWithExecutedCount:(NSUInteger)executedCount
                       succeededCount:(NSUInteger)succeededCount
                         failureCount:(NSUInteger)failureCount
                             duration:(NSTimeInterval)duration {
    self = [super init];
    if (self) {
        _executedCount = executedCount;
        _succeededCount = succeededCount;
        _failureCount = failureCount;
        _duration = duration;
    }
    return self;
}

- (NSString *)jsonString {
    NSDictionary *jsonDictionary =
        @{@"total": @(self.executedCount),
          @"passed": @(self.succeededCount),
          @"failed": @(self.failureCount),
          @"ignored": @(0),
          @"duration": @(self.duration),
          @"executed": @(YES)};

    NSError *error = nil;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:jsonDictionary
                                                       options:kNilOptions
                                                         error:&error];
    if (error) {
        NSLog(@"%@", error);
        
        return nil;
    }

    return [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
}

@end
