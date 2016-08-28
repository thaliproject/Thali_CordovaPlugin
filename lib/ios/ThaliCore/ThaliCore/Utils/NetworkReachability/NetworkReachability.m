//
//  NetworkReachability.m
//  ThaliCore
//
//  Created by Dersim Davaod on 8/17/16.
//  Copyright © 2016 Thali. All rights reserved.
//

#import <ifaddrs.h>
#import <net/if.h>
#import <SystemConfiguration/CaptiveNetwork.h>

#import "NetworkReachability.h"

@implementation NetworkReachability

- (BOOL)isWiFiEnabled {

    NSCountedSet * cset = [NSCountedSet new];

    struct ifaddrs *interfaces;

    if( ! getifaddrs(&interfaces) ) {
        for (struct ifaddrs *interface = interfaces; interface; interface = interface->ifa_next) {
            if ( (interface->ifa_flags & IFF_UP) == IFF_UP ) {
                [cset addObject:[NSString stringWithUTF8String:interface->ifa_name]];
            }
        }
    }

    NSString *aimInterface = @"awdl0";

    return [cset countForObject:aimInterface] > 1 ? YES : NO;
}

- (NSDictionary *)wifiDetails {
    return
    (__bridge NSDictionary *)
    CNCopyCurrentNetworkInfo(
                             CFArrayGetValueAtIndex( CNCopySupportedInterfaces(), 0)
                             );
}

- (BOOL)isWiFiConnected {
    return [self wifiDetails] == nil ? NO : YES;
}

@end
