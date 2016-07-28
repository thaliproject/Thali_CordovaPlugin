//
//  THEPeerBluetoothDelegate.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

// Forward declarations.
@class THEPeerBluetooth;

// THEPeerBluetoothDelegate protocol.
@protocol THEPeerBluetoothDelegate <NSObject>

// Notifies the delegate about changes to bluetooth state
- (void)peerBluetooth:(THEPeerBluetooth *)peerBluetooth didUpdateState:(BOOL)bluetoothEnabled;

// Notifies the delegate that a peer was connected.
- (void)peerBluetooth:(THEPeerBluetooth *)peerBluetooth
didConnectPeerIdentifier:(NSString *)peerIdentifier
                peerName:(NSString *)peerName;

// Notifies the delegate that a peer was disconnected.
- (void)peerBluetooth:(THEPeerBluetooth *)peerBluetooth
didDisconnectPeerIdentifier:(NSString *)peerIdentifier;

@end
