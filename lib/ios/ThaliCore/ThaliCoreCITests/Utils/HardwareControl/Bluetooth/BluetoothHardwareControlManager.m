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
    Class bm = NSClassFromString(@"BluetoothManager");
    return (BluetoothManager *)[bm sharedInstance];
}

+ (BluetoothHardwareControlManager *)sharedInstance
{
    static BluetoothHardwareControlManager *bluetoothManager = nil;
    static dispatch_once_t onceToken;

    dispatch_once(&onceToken, ^{
        frameworkHandle = dlopen("/System/Library/PrivateFrameworks/BluetoothManager.framework/BluetoothManager", RTLD_NOW);
        if (frameworkHandle) {
            bluetoothManager = [[BluetoothHardwareControlManager alloc] init];
        }
    });

    return bluetoothManager;
}

- (instancetype)init
{
    if (self = [super init]) {
        _observers = [[NSMutableArray alloc] init];
        _privateBluetoothManager = [BluetoothHardwareControlManager bluetoothManagerSharedInstance];
    }

    [self addNotification];

    return self;
}

- (void)addNotification
{
    [[NSNotificationCenter defaultCenter]
        addObserver:self
           selector:@selector(bluetoothPowerStateChanged:)
               name:PowerChangedNotification
             object:nil];
}

#pragma mark - class methods

- (BOOL)bluetoothIsPowered
{
    return [[BluetoothHardwareControlManager bluetoothManagerSharedInstance] powered];
}

- (void)turnBluetoothOn
{
    if (![self bluetoothIsPowered]) {
        [[BluetoothHardwareControlManager bluetoothManagerSharedInstance] setPowered:YES];
    }
}

- (void)turnBluetoothOff
{
    if ([self bluetoothIsPowered]) {
        [[BluetoothHardwareControlManager bluetoothManagerSharedInstance] setPowered:NO];
    }
}

#pragma mark - Observer methods

- (void)registerObserver:(id<BluetoothHardwareControlObserverProtocol>)observer
{
    [self.observers addObject:observer];
}

- (void)unregisterObserver:(id<BluetoothHardwareControlObserverProtocol>)observer
{
    [self.observers removeObject:observer];
}

#pragma mark - Bluetooth notifications

- (void)bluetoothPowerStateChanged:(NSNotification*)notification
{
    for (id<BluetoothHardwareControlObserverProtocol> observer in self.observers) {
        [observer receivedBluetoothManagerNotificationWithName:PowerChangedNotification];
    }
}

@end
