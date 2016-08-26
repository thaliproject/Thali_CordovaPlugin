//
//  BluetoothHarwareControlManager.m
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import "BluetoothHarwareControlManager.h"
#import "BluetoothManager.h"
#import <dlfcn.h>

static void *frameworkHandle;

@interface BluetoothHarwareControlManager ()

@property (strong, nonatomic) NSMutableArray *observers;
@property (retain, nonatomic) BluetoothManager *privateBluetoothManager;

- (void)bluetoothPowerStateChanged:(NSNotification *)notification;

- (instancetype)init;

@end

@implementation BluetoothHarwareControlManager

// Instantiate current class dynamically
+ (BluetoothManager *) bluetoothManagerSharedInstance {
    Class bm = NSClassFromString(@"BluetoothManager");
    return (BluetoothManager *)[bm sharedInstance];
}

+ (BluetoothHarwareControlManager *)sharedInstance
{
    static BluetoothHarwareControlManager *bluetoothManager = nil;
    static dispatch_once_t onceToken;
    
    dispatch_once(&onceToken, ^{
        frameworkHandle = dlopen("/System/Library/PrivateFrameworks/BluetoothManager.framework/BluetoothManager", RTLD_NOW);
        if (frameworkHandle) {
            bluetoothManager = [[BluetoothHarwareControlManager alloc] init];
        }
    });
    
    return bluetoothManager;
}

- (instancetype)init
{
    if (self = [super init]) {
        _observers = [[NSMutableArray alloc] init];
        _privateBluetoothManager = [BluetoothHarwareControlManager bluetoothManagerSharedInstance];
    }

    [self addNotification];

    return self;
}

- (void)addNotification
{
    [[NSNotificationCenter defaultCenter]
        addObserver:self
           selector:@selector(bluetoothPowerStateChanged:)
               name:@"BluetoothPowerStateChangedNotification"
             object:nil];
}

#pragma mark - class methods

- (BOOL)bluetoothIsPowered
{
    return [[BluetoothHarwareControlManager bluetoothManagerSharedInstance] powered];
}

- (void)turnBluetoothOn
{
    if (![self bluetoothIsPowered]) {
        [[BluetoothHarwareControlManager bluetoothManagerSharedInstance] setPowered:YES];
    }
}

- (void)turnBluetoothOff
{
    if ([self bluetoothIsPowered]) {
        [[BluetoothHarwareControlManager bluetoothManagerSharedInstance] setPowered:NO];
    }
}

#pragma mark - Observer methods

- (void)registerObserver:(id<BluetoothHarwareControlObserverProtocol>)observer
{
    [self.observers addObject:observer];
}

- (void)unregisterObserver:(id<BluetoothHarwareControlObserverProtocol>)observer
{
    [self.observers removeObject:observer];
}

#pragma mark - Bluetooth notifications

- (void)bluetoothPowerStateChanged:(NSNotification*)notification
{
    for (id<BluetoothHarwareControlObserverProtocol> observer in self.observers) {
        [observer receivedBluetoothNotification:PowerChangedNotification];
    }
}

@end
