//
//  THEAppContext+Tests.m
//  ThaliCore
//
//  Created by Ilya Laryionau on 7/29/16.
//  Copyright © 2016 Thali. All rights reserved.
//

#import <ThaliCore/ThaliCore-Swift.h>

#import "THEAppContext+Tests.h"

@implementation THEAppContext (Tests)

- (NSString *)executeNativeTests {
    THETestRunner *runner = [THETestRunner defaultRunner];
    [runner runTest];

    return runner.result;
}

@end
