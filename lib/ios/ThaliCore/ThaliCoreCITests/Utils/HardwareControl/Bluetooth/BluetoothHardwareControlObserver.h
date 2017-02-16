//
//  BluetoothHardwareControlObserver.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <Foundation/Foundation.h>

extern NSString *const PowerChangedNotification;

@protocol BluetoothHardwareControlObserverProtocol <NSObject>

@required
- (void)receivedBluetoothManagerNotificationWithName:(NSString *)bluetoothNotificationName;

@end
