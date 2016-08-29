//
//  BluetoothHardwareControlObserver.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <Foundation/Foundation.h>

typedef enum BluetoothHardwareControlNotification : NSUInteger {
    PowerChangedNotification,
} BluetoothHardwareControlNotification;

@protocol BluetoothHardwareControlObserverProtocol <NSObject>

@required
- (void)receivedBluetoothNotification: (BluetoothHardwareControlNotification)btNotification;

@end
