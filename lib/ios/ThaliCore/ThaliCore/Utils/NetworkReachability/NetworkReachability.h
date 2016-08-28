//
//  NetworkReachability.h
//  ThaliCore
//
//  Created by Dersim Davaod on 8/17/16.
//  Copyright © 2016 Thali. All rights reserved.
//

#ifndef NetworkReachability_h
#define NetworkReachability_h

#import <Foundation/Foundation.h>

@interface NetworkReachability : NSObject

- (BOOL)isWiFiEnabled;
- (BOOL)isWiFiConnected;

@end

#endif /* NetworkReachability_h */

