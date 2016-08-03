//
//  Thali CordovaPlugin
//  JXcoreExtension.m
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <ThaliCore/ThaliCore.h>

#import "JXcore.h"
#import "JXcoreExtension.h"

// JavaScript Callbacks
//
NSString * const JXcoreAppEnteringBackgroundJSCallbackName = @"appEnteringBackground";
NSString * const JXcoreAppEnteredForegroundJSCallbackName = @"appEnteredForeground";
NSString * const JXcoreDiscoveryAdvertisingStateUpdateJSCallbackName = @"discoveryAdvertisingStateUpdateNonTCP";
NSString * const JXcoreIncomingConnectionToPortNumberFailedJSCallbackName = @"incomingConnectionToPortNumberFailed";
NSString * const JXcoreNetworkChangedJSCallbackName = @"networkChanged";
NSString * const JXcorePeerAvailabilityChangedJSCallbackName = @"peerAvailabilityChanged";

// JavaScript Methods
//
NSString * const JXcoreStartListeningForAdvertisementsJSMethodName = @"startListeningForAdvertisements";
NSString * const JXcoreStopListeningForAdvertisementsJSMethodName = @"stopListeningForAdvertisements";
NSString * const JXcoreStartUpdateAdvertisingAndListeningJSMethodName = @"startUpdateAdvertisingAndListening";
NSString * const JXcoreStopAdvertisingAndListeningJSMethodName = @"stopAdvertisingAndListening";
NSString * const JXcoreConnectJSMethodName = @"connect";
NSString * const JXcoreDidRegisterToNativeJSMethodName = @"didRegisterToNative";
NSString * const JXcoreExecuteNativeTestsJSMethodName = @"executeNativeTests";
NSString * const JXcoreGetOSVersionJSMethodName = @"getOSVersion";
NSString * const JXcoreKillConnectionsJSMethodName = @"killConnections";

// JXcoreExtension
//
@interface JXcoreExtension () <THEThaliEventDelegate>

+ (THEAppContext *)appContext;

- (void)didRegisterNativeMethodWithName:(NSString *)name;

@end

@implementation JXcoreExtension {
    NSMutableSet <NSString *> *_registeredNativeMethods;
}

#pragma mark - Properties

+ (THEAppContext *)appContext {

    static THEAppContext *appContext = nil;
    static dispatch_once_t onceToken;

    dispatch_once(&onceToken, ^{
        appContext = [[THEAppContext alloc] init];
    });

    return appContext;
}

#pragma mark - init / deinit

- (instancetype)init {
    self = [super init];
    if (self) {
        _registeredNativeMethods = [NSMutableSet new];
    }
    return self;
}

#pragma mark - Override

- (void)defineMethods {
    THEAppContext *appContext = [JXcoreExtension appContext];
    [appContext setThaliEventDelegate:self];

    // This method must go first
    // Because we can lose notifications about registered methods
    [self defineDidRegisterToNative:appContext];

    [self defineStartListeningForAdvertisements:appContext];
    [self defineStopListeningForAdvertisements:appContext];
    [self defineStartUpdateAdvertisingAndListening:appContext];
    [self defineStopAdvertisingAndListening:appContext];
    [self defineConnect:appContext];
    [self defineKillConnections:appContext];
    [self defineGetOSVersion:appContext];
    [self defineExecuteNativeTests:appContext];
}

#pragma mark - JavaScript Callbacks

// didRegisterNativeMethodWithName - Allow JXCore to inform us that someone registered
// a JS function to native
- (void)didRegisterNativeMethodWithName:(NSString *)name {
    [_registeredNativeMethods addObject:name];

    THEAppContext *appContext = [JXcoreExtension appContext];

    if ([name isEqualToString:JXcoreNetworkChangedJSCallbackName]) {
        [appContext fireNetworkChangedEvent];
    }
}

#pragma mark - JavaScript Native Methods Registration


- (void)defineDidRegisterToNative:(THEAppContext *)appContext {
    NSString *methodName = JXcoreDidRegisterToNativeJSMethodName;

    [JXcore addNativeBlock:^(NSArray *params, NSString *callbackId) {
        if (params.count != 2 || [params[0] isKindOfClass:[NSString class]]) {
            NSLog(@"jxcore: %@ %@", methodName, params[0]);

            [self didRegisterNativeMethodWithName:params[0]];
        } else {
            NSLog(@"jxcore: %@: badParam", methodName);
        }
    } withName:methodName];
}

- (void)defineStartListeningForAdvertisements:(THEAppContext *)appContext {
    NSString *methodName = JXcoreStartListeningForAdvertisementsJSMethodName;

    [JXcore addNativeBlock:^(NSArray *params, NSString *callbackId) {
        NSLog(@"jxcore: %@", methodName);

        if ([appContext startListeningForAdvertisements]) {
            NSLog(@"jxcore: %@: success", methodName);

            @synchronized(self) {
                [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
            }
        } else {
            NSLog(@"jxcore: %@: failure", methodName);

            @synchronized(self) {
                [JXcore callEventCallback:callbackId withParams:@[@"Unknown Error!"]];
            }
        }
    } withName:methodName];
}

- (void)defineStopListeningForAdvertisements:(THEAppContext *)appContext {
    NSString *methodName = JXcoreStopListeningForAdvertisementsJSMethodName;

    [JXcore addNativeBlock:^(NSArray *params, NSString *callbackId) {
        NSLog(@"jxcore: %@", methodName);

        if ([appContext stopListeningForAdvertisements]) {
            NSLog(@"jxcore: %@: success", methodName);

            @synchronized(self) {
                [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
            }
        } else {
            NSLog(@"jxcore: %@: failure", methodName);

            @synchronized(self) {
                [JXcore callEventCallback:callbackId withParams:@[@"Unknown Error!"]];
            }
        }
    } withName:methodName];
}

- (void)defineStartUpdateAdvertisingAndListening:(THEAppContext *)appContext {
    NSString *methodName = JXcoreStartUpdateAdvertisingAndListeningJSMethodName;

    [JXcore addNativeBlock:^(NSArray *params, NSString *callbackId) {
        NSLog(@"jxcore: %@", methodName);

        if (params.count != 2 || ![params[0] isKindOfClass:[NSNumber class]]) {
            NSLog(@"jxcore: %@: bad arg", methodName);

            @synchronized(self) {
                [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
            }
        } else {
            if ([appContext startUpdateAdvertisingAndListening:(unsigned short)[params[0] intValue]]) {
                NSLog(@"jxcore: %@: success", methodName);

                @synchronized(self) {
                    [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
                }
            } else {
                NSLog(@"jxcore: %@: failure", methodName);

                @synchronized(self) {
                    [JXcore callEventCallback:callbackId withParams:@[@"Unknown Error!"]];
                }
            }
        }
    } withName:methodName];
}

- (void)defineStopAdvertisingAndListening:(THEAppContext *)appContext {
    NSString *methodName = JXcoreStopAdvertisingAndListeningJSMethodName;

    [JXcore addNativeBlock:^(NSArray *params, NSString *callbackId) {
        NSLog(@"jxcore: %@", methodName);

        if ([appContext stopAdvertisingAndListening]) {
            NSLog(@"jxcore: %@: success", methodName);

            @synchronized(self) {
                [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
            }
        } else {
            NSLog(@"jxcore: %@: failure", methodName);

            @synchronized(self) {
                [JXcore callEventCallback:callbackId withParams:@[@"Unknown Error!"]];
            }
        }
    } withName:methodName];
}

- (void)defineConnect:(THEAppContext *)appContext {
    NSString *methodName = JXcoreConnectJSMethodName;

    [JXcore addNativeBlock:^(NSArray *params, NSString *callbackId) {
        if (params.count != 2 || ![params[0] isKindOfClass:[NSString class]]) {
            NSLog(@"jxcore: %@: badParam", methodName);

            @synchronized(self) {
                [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
            }
        } else {
            NSLog(@"jxcore: %@ %@", methodName, params[0]);

            ClientConnectCallback connectCallback = ^(NSString *errorMsg, NSDictionary *connection) {
                if (errorMsg == nil) {
                    NSLog(@"jxcore: %@: success", methodName);

                    @synchronized(self) {
                        [JXcore callEventCallback:callbackId
                                       withParams:@[[NSNull null], [JXcoreExtension JSONStringWithObject:connection]]];
                    }
                } else {
                    NSLog(@"jxcore: %@: fail: %@", methodName, errorMsg);

                    @synchronized(self) {
                        [JXcore callEventCallback:callbackId withParams:@[errorMsg, [NSNull null]]];
                    }
                }
            };

            // We'll callback to the upper layer when the connect completes or fails
            [appContext connectToPeer:params[0] connectCallback:connectCallback];
        }
    } withName:methodName];
}

- (void)defineKillConnections:(THEAppContext *)appContext {
    NSString *methodName = JXcoreKillConnectionsJSMethodName;

    [JXcore addNativeBlock:^(NSArray *params, NSString *callbackId) {
        NSLog(@"jxcore: %@", methodName);

        if (params.count != 2 || ![params[0] isKindOfClass:[NSString class]]) {
            NSLog(@"jxcore: %@: badParam", methodName);

            @synchronized(self) {
                [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
            }
        } else {
            if ([appContext killConnections:params[0]]) {
                NSLog(@"jxcore: %@: success", methodName);

                @synchronized(self) {
                    [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
                }
            } else {
                NSLog(@"jxcore: %@: fail", methodName);

                @synchronized(self) {
                    [JXcore callEventCallback:callbackId withParams:@[@"Not connected to specified peer"]];
                }
            }
        }
    } withName:methodName];
}

- (void)defineGetOSVersion:(THEAppContext *)appContext {
    NSString *methodName = JXcoreGetOSVersionJSMethodName;

    [JXcore addNativeBlock:^(NSArray *params, NSString *callbackId) {
        NSString * const version = [NSProcessInfo processInfo].operatingSystemVersionString;

        @synchronized(self) {
            [JXcore callEventCallback:callbackId withParams:@[version]];
        }
    } withName:methodName];
}

- (void)defineExecuteNativeTests:(THEAppContext *)appContext {
    NSString *methodName = JXcoreExecuteNativeTestsJSMethodName;

    [JXcore addNativeBlock:^(NSArray *params, NSString *callbackId) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wundeclared-selector"
        if ([appContext respondsToSelector:@selector(executeNativeTests)]) {
            NSString *result = [appContext performSelector:@selector(executeNativeTests)];
#pragma clang diagnostic pop

            if (result) {
                NSLog(@"jxcore: %@: success", methodName);

                @synchronized(self) {
                    [JXcore callEventCallback:callbackId withJSON:result];
                }
            } else {
                NSLog(@"jxcore: %@: fail", methodName);

                @synchronized(self) {
                    [JXcore callEventCallback:callbackId withParams:@[@"Tests results are empty"]];
                }
            }
        } else {
            @synchronized(self) {
                [JXcore callEventCallback:callbackId withParams:@[@"Method not available"]];
            }
        }
    } withName:methodName];
}

#pragma mark - Helper Methods

+ (NSString *)JSONStringWithObject:(NSObject *)object {
    NSError *error = nil;
    NSData *data = [NSJSONSerialization dataWithJSONObject:object options:kNilOptions error:&error];

    if (error != nil) {
        @throw error;
    }

    NSString *json = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];

    return json;
}

#pragma mark - THEThaliEventDelegate

- (void)networkChanged:(NSDictionary *)networkStatus {
    @synchronized(self) {
        if ([_registeredNativeMethods containsObject:JXcoreNetworkChangedJSCallbackName]) {
            [JXcore callEventCallback:JXcoreNetworkChangedJSCallbackName
                             withJSON:[JXcoreExtension JSONStringWithObject:networkStatus]];
        }
    }
}

- (void)peerAvailabilityChanged:(NSArray<NSDictionary *> *)peers {
    @synchronized(self) {
        [JXcore callEventCallback:JXcorePeerAvailabilityChangedJSCallbackName
                         withJSON:[JXcoreExtension JSONStringWithObject:peers]];
    }
}

- (void)discoveryAdvertisingStateUpdate:(NSDictionary *)stateUpdate {
    @synchronized(self) {
        [JXcore callEventCallback:JXcoreDiscoveryAdvertisingStateUpdateJSCallbackName
                         withJSON:[JXcoreExtension JSONStringWithObject:stateUpdate]];
    }
}

- (void)incomingConnectionToPortNumberFailed:(unsigned short)serverPort {
    @synchronized(self) {
        [JXcore callEventCallback:JXcoreIncomingConnectionToPortNumberFailedJSCallbackName
                       withParams:@[@(serverPort)]];
    }
}

- (void)appEnteringBackground {
    @synchronized(self) {
        [JXcore callEventCallback:JXcoreAppEnteringBackgroundJSCallbackName
                       withParams:@[]];
    }
}

- (void)appEnteredForeground {
    @synchronized(self) {
        [JXcore callEventCallback:JXcoreAppEnteredForegroundJSCallbackName
                       withParams:@[]];
    }
}

@end
