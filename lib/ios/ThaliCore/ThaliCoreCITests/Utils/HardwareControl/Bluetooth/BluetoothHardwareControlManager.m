//
//  BluetoothHardwareControlManager.m
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import "BluetoothHardwareControlManager.h"
#import "BluetoothManager.h"
#import <dlfcn.h>

static void *frameworkHandle;

@interface BluetoothHardwareControlManager ()

@property (strong, nonatomic) NSMutableArray *observers;
@property (retain, nonatomic) BluetoothManager *privateBluetoothManager;

- (void)bluetoothPowerStateChanged:(NSNotification *)notification;

- (instancetype)init;

@end

@implementation BluetoothHardwareControlManager

// Instantiate current class dynamically
+ (BluetoothManager *) bluetoothManagerSharedInstance {
    NSLog(@"Getting private API's class");
    Class bm = NSClassFromString(@"BluetoothManager");
    NSLog(@"Finishing getting private API's class %@", bm);
    return (BluetoothManager *)[bm sharedInstance];
}

+ (BluetoothHardwareControlManager *)sharedInstance
{
    NSLog(@"Getting shared instance of BTmanager");
    static BluetoothHardwareControlManager *bluetoothManager = nil;
    static dispatch_once_t onceToken;

    dispatch_once(&onceToken, ^{
        NSLog(@"Dispatch_once working");
        frameworkHandle = dlopen("/System/Library/PrivateFrameworks/BluetoothManager.framework/BluetoothManager", RTLD_NOW);
        if (frameworkHandle) {
            bluetoothManager = [[BluetoothHardwareControlManager alloc] init];
        }
        NSLog(@"Finishing dispatch_once working with handle: %@ and BTmanager: %@", frameworkHandle, bluetoothManager);
    });

    NSLog(@"Finishing getting shared instance of BTmanager %@", bluetoothManager);

    return bluetoothManager;
}

- (instancetype)init
{
    NSLog(@"Initializing BluetoothHardwareControlManager");
    if (self = [super init]) {
        _observers = [[NSMutableArray alloc] init];
        _privateBluetoothManager = [BluetoothHardwareControlManager bluetoothManagerSharedInstance];
    }

    [self addNotification];
    NSLog(@"Finishing initializing BluetoothHardwareControlManager");

    return self;
}

- (void)addNotification
{
    NSLog(@"Adding notification in BluetoothHardwareControlManager");
    [[NSNotificationCenter defaultCenter]
        addObserver:self
           selector:@selector(bluetoothPowerStateChanged:)
               name:PowerChangedNotification
             object:nil];
    NSLog(@"Adding notification in BluetoothHardwareControlManager");
}

#pragma mark - class methods

- (BOOL)bluetoothIsPowered
{
    NSLog(@"Checking BT private state");
    return [[BluetoothHardwareControlManager bluetoothManagerSharedInstance] powered];
}

- (void)turnBluetoothOn
{
    if (![self bluetoothIsPowered]) {
        NSLog(@"Changing BT private state to On");
        [[BluetoothHardwareControlManager bluetoothManagerSharedInstance] setPowered:YES];
    }
}

- (void)turnBluetoothOff
{
    if ([self bluetoothIsPowered]) {
        NSLog(@"Changing BT private state to Off");
        [[BluetoothHardwareControlManager bluetoothManagerSharedInstance] setPowered:NO];
    }
}

#pragma mark - Observer methods

- (void)registerObserver:(id<BluetoothHardwareControlObserverProtocol>)observer
{
    NSLog(@"Registering observer in BluetoothHardwareControlManager");
    [self.observers addObject:observer];
    NSLog(@"Finishing registering observer in BluetoothHardwareControlManager");
}

- (void)unregisterObserver:(id<BluetoothHardwareControlObserverProtocol>)observer
{
    NSLog(@"Unregistering observer in BluetoothHardwareControlManager");
    [self.observers removeObject:observer];
    NSLog(@"Observers:");
    for (id<BluetoothHardwareControlObserverProtocol> observer in self.observers) {
        NSLog(@"Observer: %@", observer);
    }
    NSLog(@"Finishing unregistering observer in BluetoothHardwareControlManager");
}

#pragma mark - Bluetooth notifications

- (void)bluetoothPowerStateChanged:(NSNotification*)notification
{
    NSLog(@"BluetoothHardwareControlManager notification received.");
    for (id<BluetoothHardwareControlObserverProtocol> observer in self.observers) {
        [observer receivedBluetoothManagerNotificationWithName:PowerChangedNotification];
    }
}

@end
