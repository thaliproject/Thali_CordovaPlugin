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
            appContext = [[AppContext alloc] init];
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
#endif
}

- (void)defineStartListeningForAdvertisements:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
        if ([appContext startListeningForAdvertisements]) {
            @synchronized(self) {
                [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
            }
        }
        else {
            @synchronized(self) {
                [JXcore callEventCallback:callbackId withParams:@[@"Unknown Error!"]];
            }
        }
    } withName:[AppContext startListeningForAdvertisements]];
}

- (void)defineStopListeningForAdvertisements:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
        if ([appContext stopListeningForAdvertisements]) {
            @synchronized(self) {
                [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
            }
        }
        else {
            @synchronized(self) {
                [JXcore callEventCallback:callbackId withParams:@[@"Unknown Error!"]];
            }
        }
    } withName:[AppContext stopListeningForAdvertisements]];
}

- (void)defineStartUpdateAdvertisingAndListening:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
        if (params.count != 2 || ![params[0] isKindOfClass:[NSNumber class]]) {
            @synchronized(self) {
                [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
            }
        }
        else {
            if ([appContext startUpdateAdvertisingAndListeningWithServerPort:(unsigned short)[params[0] intValue]]) {
                @synchronized(self) {
                    [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
                }
            }
            else {
                @synchronized(self)
                {
                    [JXcore callEventCallback:callbackId withParams:@[@"Unknown Error!"]];
                }
            }
        }
    } withName:[AppContext startUpdateAdvertisingAndListening]];
}

- (void)defineStopAdvertisingAndListening:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
        if ([appContext stopAdvertisingAndListening]) {
            @synchronized(self) {
                [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
            }
        }
        else {
            @synchronized(self)
            {
                [JXcore callEventCallback:callbackId withParams:@[@"Unknown Error!"]];
            }
        }
    } withName:[AppContext stopAdvertisingAndListening]];
}

- (void)defineConnect:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId) {
        if (params.count != 2 || ![params[0] isKindOfClass:[NSString class]]) {
            @synchronized(self) {
                [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
            }
        }
        else {
            void (^connectCallback)(NSString *, NSString *) = ^(NSString *errorMsg, NSString *connection) {
                if (errorMsg == nil) {
                    @synchronized(self) {
                        [JXcore callEventCallback:callbackId withParams:
                         @[[NSNull null], connection]];
                    }
                }
                else {
                    @synchronized(self) {
                        [JXcore callEventCallback:callbackId withParams:@[errorMsg, [NSNull null]]];
                    }
                }
            };
            
            [appContext connectToPeer:params[0] callback:connectCallback];
        }
    } withName:[AppContext connect]];
}

- (void)defineKillConnections:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId) {
        if (params.count != 2 || ![params[0] isKindOfClass:[NSString class]]) {
            @synchronized(self) {
                [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
            }
        }
        else {
            if ([appContext killConnection: params[0]]) {
                @synchronized(self) {
                    [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
                }
            }
            else {
                @synchronized(self) {
                    [JXcore callEventCallback:callbackId withParams:@[@"Not connected to specified peer"]];
                }
            }
        }
    } withName:[AppContext killConnections]];
}

- (void)defineDidRegisterToNative:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId) {
        if (params.count != 2 || ![params[0] isKindOfClass:[NSString class]]) {
        }
        else {
            [appContext didRegisterToNative: params[0]];
        }
    } withName:[AppContext didRegisterToNative]];
}

- (void)defineGetOSVersion:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId) {
        NSString * const version = [appContext getIOSVersion];
        @synchronized(self) {
            [JXcore callEventCallback:callbackId withParams:@[version]];
        }
    } withName:[AppContext getOSVersion]];
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
    } withName:[AppContext executeNativeTests]];
}
#endif

@end

@implementation JXcoreExtension(AppContextDelegate)

- (void)context:(AppContext * _Nonnull)context didChangePeerAvailability:(NSString * _Nonnull)peers {
    @synchronized(self) {
        [JXcore callEventCallback:[AppContext peerAvailabilityChanged]
                         withJSON:peers];
    }
}

- (void)context:(AppContext * _Nonnull)context didChangeNetworkStatus:(NSString * _Nonnull)status {
    @synchronized(self) {
        [JXcore callEventCallback:[AppContext networkChanged]
                         withJSON:status];
    }
}

- (void)context:(AppContext * _Nonnull)context didUpdateDiscoveryAdvertisingState:(NSString * _Nonnull)discoveryAdvertisingState {
    @synchronized(self) {
        [JXcore callEventCallback:[AppContext discoveryAdvertisingStateUpdateNonTCP]
                         withJSON:discoveryAdvertisingState];
    }
}

- (void)context:(AppContext * _Nonnull)context didFailIncomingConnectionToPort:(uint16_t)port {
    @synchronized(self) {
        [JXcore callEventCallback:[AppContext incomingConnectionToPortNumberFailed] withParams:@[@(port)]];
    }
}

- (void)appWillEnterBackgroundWithContext:(AppContext * _Nonnull)context {
    @synchronized(self) {
        [JXcore callEventCallback:[AppContext appEnteringBackground] withParams:@[]];
    }
}

- (void)appDidEnterForegroundWithContext:(AppContext * _Nonnull)context {
    @synchronized(self) {
        [JXcore callEventCallback:[AppContext appEnteredForeground] withParams:@[]];
    }
}

@end
