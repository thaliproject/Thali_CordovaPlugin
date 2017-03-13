//
//  Thali CordovaPlugin
//  NetworkReachability.m
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <ifaddrs.h>
#import <net/if.h>
#import <SystemConfiguration/CaptiveNetwork.h>

#import "NetworkReachability.h"

@implementation NetworkReachability

- (BOOL)isWiFiEnabled {

    /*
     * The getifaddrs() function stores a reference to a linked list of the network
     * interfaces on the local machine. The list consists of ifaddrs structures.
     *
     * The ifaddrs struct contains ifa_flags field.
     * The ifa_flags field contains the interface status flags
     * (See if.h file for a list of these flags.)
     *
     * Next, we are trying to find out if awdl0 interface is up.
     * "awdl" stands for Apple Wireless Direct Link - in fact it's AirDrop
     * Since we don't need to have access point (because it's p2p),
     * we can have network stack up without being connected to whatever.
     *
     * For additional information, see:
     * man 3 getifaddrs
     * http://stackoverflow.com/questions/19587701/what-is-awdl-apple-wireless-direct-link-and-how-does-it-work
     */

    NSCountedSet *localNetworkInterfacesSet = [NSCountedSet new];

    struct ifaddrs *interfaces;

    if( ! getifaddrs(&interfaces) ) {
        for (struct ifaddrs *interface = interfaces; interface; interface = interface->ifa_next) {
            BOOL interfaceIsUp = (interface->ifa_flags & IFF_UP) == IFF_UP;
            if (interfaceIsUp) {
                [localNetworkInterfacesSet addObject:[NSString stringWithUTF8String:interface->ifa_name]];
            }
        }
    }

    // It's important to free data returned by getifaddrs()
    // This data is dynamically allocated and should be
    // freed using freeifaddrs() when no longer needed.
    freeifaddrs(interfaces);

    NSString *AWDLInterface = @"awdl0";
    BOOL wifiSwitchedOn = [localNetworkInterfacesSet countForObject:AWDLInterface] > 1;

    return wifiSwitchedOn;
}

- (NSDictionary *)wifiDetails {
    /*
     * CNCopySupportedInterfaces returns the network interface names.
     * Then with help of CNCopyCurrentNetworkInfo we get interface's current network info.
     *
     * For more information see: 
     * https://developer.apple.com/reference/systemconfiguration/1494829-cncopysupportedinterfaces
     * https://developer.apple.com/reference/systemconfiguration/1614126-cncopycurrentnetworkinfo
     */
    
    CFArrayRef supportedInterfaces = CNCopySupportedInterfaces();
    CFDictionaryRef details = CNCopyCurrentNetworkInfo(CFArrayGetValueAtIndex(supportedInterfaces , 0));
    CFRelease(supportedInterfaces);
    return (__bridge_transfer NSDictionary *)details;
}

- (BOOL)isWiFiConnected {
    return [self wifiDetails] == nil ? NO : YES;
}

- (NSString *)BSSID {
    return [self wifiDetails][(__bridge NSString *)kCNNetworkInfoKeyBSSID];
}

- (NSString *)SSID {
    return [self wifiDetails][(__bridge NSString *)kCNNetworkInfoKeySSID];
}

@end
