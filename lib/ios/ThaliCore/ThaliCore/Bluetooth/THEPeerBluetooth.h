//
//  THEPeerBluetooth.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <Foundation/Foundation.h>
#import "THEPeerBluetoothDelegate.h"

// THEPeerBluetooth interface.v
@interface THEPeerBluetooth : NSObject

// Class initializer, will start advertising/scanning immediately
- (instancetype)initWithServiceType:(NSUUID *)serviceType
                     peerIdentifier:(NSString *)peerIdentifier
                           peerName:(NSString *)peerName
                  bluetoothDelegate:(id<THEPeerBluetoothDelegate>)delegate;

// Stops the BLE layer, must be called prior to destruction
- (void)stop;

@end
