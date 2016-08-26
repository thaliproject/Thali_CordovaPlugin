//
//  BluetoothHarwareControlManager.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <Foundation/Foundation.h>
#import "BluetoothHarwareControlObserver.h"

@interface BluetoothHarwareControlManager : NSObject

+ (BluetoothHarwareControlManager *)sharedInstance;

- (BOOL)bluetoothIsPowered;
- (void)turnBluetoothOn;
- (void)turnBluetoothOff;

- (void)registerObserver:(id<BluetoothHarwareControlObserverProtocol>)observer;
- (void)unregisterObserver:(id<BluetoothHarwareControlObserverProtocol>)observer;

@end
