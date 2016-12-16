//
//  BluetoothHardwareControlManager.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <Foundation/Foundation.h>
#import "BluetoothHardwareControlObserver.h"

@interface BluetoothHardwareControlManager : NSObject

+ (BluetoothHardwareControlManager *)sharedInstance;

- (BOOL)bluetoothIsPowered;
- (void)turnBluetoothOn;
- (void)turnBluetoothOff;

- (void)registerObserver:(id<BluetoothHardwareControlObserverProtocol>)observer;
- (void)unregisterObserver:(id<BluetoothHardwareControlObserverProtocol>)observer;

@end
