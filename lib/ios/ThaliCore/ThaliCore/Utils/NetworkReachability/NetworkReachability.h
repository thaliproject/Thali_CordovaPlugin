//
//  Thali CordovaPlugin
//  NetworkReachability.h
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#ifndef NetworkReachability_h
#define NetworkReachability_h

#import <Foundation/Foundation.h>

@interface NetworkReachability : NSObject

- (BOOL)isWiFiEnabled;
- (BOOL)isWiFiConnected;
- (NSString *)BSSID;
- (NSString *)SSID;

@end

#endif /* NetworkReachability_h */
