//
//  Thali CordovaPlugin
//  JXcoreExtension.m
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import "JXcore.h"
#import "JXcoreExtension.h"
#import "ThaliTest-swift.h"

// JXcoreExtension implementation.
@interface JXcoreExtension (AppContextDelegate) <AppContextDelegate>

@end

@implementation JXcoreExtension

- (instancetype)init {
    if (self = [super init]) {
        return self;
    }
    return nil;
}

#pragma mark - Define public API to node methods

// Defines methods.
- (void)defineMethods {
    static AppContext * appContext = nil;

    if (!appContext) {
        static dispatch_once_t onceToken;
        dispatch_once(&onceToken, ^{
            appContext = [[AppContext alloc] initWithServiceType:@"thaliproject"];
        });
    }
    appContext.delegate = self;

    // Export the public API to node
    [self defineStartListeningForAdvertisements:appContext];
    [self defineStopListeningForAdvertisements:appContext];
    [self defineStartUpdateAdvertisingAndListening:appContext];
    [self defineStopAdvertisingAndListening:appContext];
    [self defineConnect:appContext];
    [self defineKillConnections:appContext];
    [self defineDidRegisterToNative:appContext];
    [self defineGetOSVersion:appContext];
#ifdef TEST
    [self defineExecuteNativeTests:appContext];

//    // Dersim Davaod (8/19/16):
//    // For some unknown reasons we should invoke
//    // sharedInstance method on main thread at the early time.
//    dispatch_async(dispatch_get_main_queue(), ^{
//        [[BluetoothHardwareControlManager sharedInstance] bluetoothIsPowered];
//    });
#endif
}

- (void)handleCallback:(NSString *)callback error:(NSError *)error {
    @synchronized(self) {
        if (error == nil) {
            [JXcore callEventCallback:callback withParams:@[[NSNull null]]];
        } else {
            [JXcore callEventCallback:callback withParams:@[error.localizedDescription]];
        }
    }
}

- (void)defineStartListeningForAdvertisements:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
        NSError *error = nil;
        [appContext startListeningForAdvertisementsAndReturnError:&error];
        [self handleCallback:callbackId error:error];
    } withName:[AppContextJSEvent startListeningForAdvertisements]];
}

- (void)defineStopListeningForAdvertisements:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
        NSError *error = nil;
        [appContext stopListeningForAdvertisementsAndReturnError:&error];
        [self handleCallback:callbackId error:error];
    } withName:[AppContextJSEvent stopListeningForAdvertisements]];
}

- (void)defineStartUpdateAdvertisingAndListening:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
        NSError *error = nil;
        [appContext startUpdateAdvertisingAndListeningWithParameters:params error:&error];
        [self handleCallback:callbackId error:error];
    } withName:[AppContextJSEvent startUpdateAdvertisingAndListening]];
}

- (void)defineStopAdvertisingAndListening:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
        NSError *error = nil;
        [appContext stopAdvertisingAndListeningAndReturnError:&error];
        [self handleCallback:callbackId error:error];
    } withName:[AppContextJSEvent stopAdvertisingAndListening]];
}

- (void)defineConnect:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId) {
        NSError *error = nil;
        [appContext multiConnectToPeer:params error:&error];
        [self handleCallback:callbackId error:error];
    } withName:[AppContextJSEvent connect]];
}

- (void)defineKillConnections:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId) {
        NSError *error = nil;
        [appContext killConnection:params error:&error];
        [self handleCallback:callbackId error:error];
    } withName:[AppContextJSEvent killConnections]];
}

- (void)defineDidRegisterToNative:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId) {
        NSError *error = nil;
        [appContext didRegisterToNative: params error:&error];
        [self handleCallback:callbackId error:error];

    } withName:[AppContextJSEvent didRegisterToNative]];
}

- (void)defineGetOSVersion:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId) {
        NSString * const version = [appContext getIOSVersion];
        @synchronized(self) {
            [JXcore callEventCallback:callbackId withParams:@[version]];
        }
    } withName:[AppContextJSEvent getOSVersion]];
}

#ifdef TEST
- (void)defineExecuteNativeTests:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wundeclared-selector"
        if ([appContext respondsToSelector:@selector(executeNativeTests)]) {
            NSString *result = [appContext performSelector:@selector(executeNativeTests)];
#pragma clang diagnostic pop

            @synchronized(self) {
                [JXcore callEventCallback:callbackId withJSON:result];
            }
        }
        else {
            @synchronized(self) {
                [JXcore callEventCallback:callbackId withParams:@[@"Method not available"]];
            }
        }
    } withName:[AppContextJSEvent executeNativeTests]];
}
#endif

@end

@implementation JXcoreExtension(AppContextDelegate)

- (void)context:(AppContext * _Nonnull)context didChangePeerAvailability:(NSString * _Nonnull)peers {
    @synchronized(self) {
        [JXcore callEventCallback:[AppContextJSEvent peerAvailabilityChanged]
                         withJSON:peers];
    }
}

- (void)context:(AppContext * _Nonnull)context didChangeNetworkStatus:(NSString * _Nonnull)status {
    @synchronized(self) {
        [JXcore callEventCallback:[AppContextJSEvent networkChanged]
                         withJSON:status];
    }
}

- (void)context:(AppContext * _Nonnull)context didUpdateDiscoveryAdvertisingState:(NSString * _Nonnull)discoveryAdvertisingState {
    @synchronized(self) {
        [JXcore callEventCallback:[AppContextJSEvent discoveryAdvertisingStateUpdateNonTCP]
                         withJSON:discoveryAdvertisingState];
    }
}

- (void)context:(AppContext * _Nonnull)context didFailIncomingConnectionToPort:(uint16_t)port {
    @synchronized(self) {
        [JXcore callEventCallback:[AppContextJSEvent incomingConnectionToPortNumberFailed] withParams:@[@(port)]];
    }
}

- (void)appWillEnterBackgroundWithContext:(AppContext * _Nonnull)context {
    @synchronized(self) {
        [JXcore callEventCallback:[AppContextJSEvent appEnteringBackground] withParams:@[]];
    }
}

- (void)appDidEnterForegroundWithContext:(AppContext * _Nonnull)context {
    @synchronized(self) {
        [JXcore callEventCallback:[AppContextJSEvent appEnteredForeground] withParams:@[]];
    }
}

@end
