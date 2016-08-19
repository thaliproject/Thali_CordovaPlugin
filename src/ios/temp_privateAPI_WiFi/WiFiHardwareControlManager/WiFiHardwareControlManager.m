//
//  WiFiHardwareControlManager.m
//  ThaliTest
//
//  Created by Dersim Davaod on 8/18/16.
//
//

#import "WiFiHardwareControlManager.h"
#import "WiFiDeviceClient.h"
#import "WiFiManager.h"

#import <dlfcn.h>

static void *frameworkHandle;

@interface WiFiHardwareControlManager () {
    WiFiManagerRef _internalWiFiManager;
}

- (instancetype)init;

@end

@implementation WiFiHardwareControlManager

+ (WiFiHardwareControlManager *)sharedInstance
{
    static WiFiHardwareControlManager *wifiManager = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        frameworkHandle = dlopen("/System/Library/PrivateFrameworks/MobileWiFi.framework/MobileWiFi", RTLD_NOW);
        if (frameworkHandle) {
            wifiManager = [[WiFiHardwareControlManager alloc] init];
        }
    });
    return wifiManager;
}

- (instancetype)init
{
    if (self = [super init]) {
        WiFiManagerRef (*clientCreate) (CFAllocatorRef allocator, int flags) =
            (WiFiManagerRef (*) (CFAllocatorRef allocator, int flags))dlsym(frameworkHandle, "WiFiManagerClientCreate");
        WiFiDeviceClientRef (*getDevice)(WiFiManagerRef manager) =
            (WiFiDeviceClientRef (*)(WiFiManagerRef manager))dlsym(frameworkHandle, "WiFiManagerClientGetDevice");
        CFArrayRef (*copyDevices)(void* manager) =
            (CFArrayRef (*)(void* manager))dlsym(frameworkHandle, "WiFiManagerClientCopyDevices");
        void (*clientEnable) (void* manager) =
            (void (*) (void* manager))dlsym(frameworkHandle, "WiFiManagerClientEnable");
        void (*allowClient)(WiFiManagerRef manager, CFStringRef property, CFPropertyListRef value) =
            (void (*)(WiFiManagerRef manager, CFStringRef property, CFPropertyListRef value))dlsym(frameworkHandle, "WiFiManagerClientSetProperty");



        _internalWiFiManager = clientCreate(kCFAllocatorDefault, 1);
        WiFiDeviceClientRef device = getDevice(_internalWiFiManager);
        print(device)

        NSArray* devices = (__bridge NSArray *)(copyDevices(_internalWiFiManager));
        if (devices && [devices count])
        {
            void* device = (__bridge void *)([devices firstObject]);

            void (*setPower)(void* device, int powerState) =
            (void (*)(void* device, int powerState))dlsym(frameworkHandle, "WiFiDeviceClientSetPower");

            setPower(device, (int)1);
        }

//        clientEnable(_internalWiFiManager);
        allowClient(_internalWiFiManager,  CFSTR("AllowEnable"), kCFBooleanTrue);

//        [[objc_getClass("SBWiFiManager") sharedInstance] setWiFiEnabled:YES];
    }
    return self;
}


@end

