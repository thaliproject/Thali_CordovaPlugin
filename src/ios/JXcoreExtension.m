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

+ (AppContext *)appContext {
    // Singleton instance.
    static AppContext * appContext = nil;

    // If unallocated, allocate.
    if (!appContext) {
        // Dispatch allocator once.
        static dispatch_once_t onceToken;
        dispatch_once(&onceToken, ^{
            appContext = [[AppContext alloc] init];
        });
    }

    // Done.
    return appContext;
}

+ (NSString *)objectToJSON:(NSObject *)object {
    NSError *err = nil;
    NSString *json = [[NSString alloc] initWithData:
                      [NSJSONSerialization dataWithJSONObject:object options:0 error:&err]
                                           encoding:NSUTF8StringEncoding
                      ];

    if (err != nil) {
        @throw err;
    }

    return json;
}

#pragma mark - Define public API to node methods

// Defines methods.
- (void)defineMethods {
    AppContext *appContext = [JXcoreExtension appContext];
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
    [self defineExecuteNativeTests:appContext];
}

- (void)defineStartListeningForAdvertisements:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
         NSLog(@"jxcore: startListeningForAdvertisements");

         if ([appContext startListeningForAdvertisements]) {
             NSLog(@"jxcore: startListeningForAdvertisements: success");

             @synchronized(self) {
                 [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
             }
         }
         else {
             NSLog(@"jxcore: startListeningForAdvertisements: failure");

             @synchronized(self) {
                 [JXcore callEventCallback:callbackId withParams:@[@"Unknown Error!"]];
             }
         }
     } withName:[AppContext startListeningForAdvertisements]];
}

- (void)defineStopListeningForAdvertisements:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
         NSLog(@"jxcore: stopListeningForAdvertisements");

         if ([appContext stopListeningForAdvertisements]) {
             NSLog(@"jxcore: stopListeningForAdvertisements: success");

             @synchronized(self) {
                 [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
             }
         }
         else {
             NSLog(@"jxcore: stopListeningForAdvertisements: failure");

             @synchronized(self) {
                 [JXcore callEventCallback:callbackId withParams:@[@"Unknown Error!"]];
             }
         }
     } withName:[AppContext stopListeningForAdvertisements]];
}

- (void)defineStartUpdateAdvertisingAndListening:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
         NSLog(@"jxcore: startUpdateAdvertisingAndListening");

         if (params.count != 2 || ![params[0] isKindOfClass:[NSNumber class]]) {
             NSLog(@"jxcore: startUpdateAdvertisingAndListening: bad arg");

             @synchronized(self) {
                 [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
             }
         }
         else {
             if ([appContext startUpdateAdvertisingAndListeningWithServerPort:(unsigned short)[params[0] intValue]]) {
                 NSLog(@"jxcore: startUpdateAdvertisingAndListening: success");

                 @synchronized(self) {
                     [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
                 }
             }
             else {
                 NSLog(@"jxcore: startUpdateAdvertisingAndListening: failure");

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
         NSLog(@"jxcore: stopAdvertisingAndListening");

         if ([appContext stopAdvertisingAndListening]) {
             NSLog(@"jxcore: stopAdvertisingAndListening: success");

             @synchronized(self) {
                 [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
             }
         }
         else {
             NSLog(@"jxcore: stopAdvertisingAndListening: failure");

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
             NSLog(@"jxcore: connect: badParam");

             @synchronized(self) {
                 [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
             }
         }
         else {
             NSLog(@"jxcore: connect %@", params[0]);
             void (^connectCallback)(NSString *, NSDictionary *) = ^(NSString *errorMsg, NSDictionary *connection) {
                 if (errorMsg == nil) {
                     NSLog(@"jxcore: connect: success");

                     @synchronized(self) {
                         [JXcore callEventCallback:callbackId withParams:
                          @[[NSNull null], [JXcoreExtension objectToJSON:connection]]];
                     }
                 }
                 else {
                     NSLog(@"jxcore: connect: fail: %@", errorMsg);

                     @synchronized(self) {
                         [JXcore callEventCallback:callbackId withParams:@[errorMsg, [NSNull null]]];
                     }
                 }
             };

             // We'll callback to the upper layer when the connect completes or fails
             [appContext connectToPeer:params[0] callback:connectCallback];
         }
     } withName:[AppContext connect]];
}

- (void)defineKillConnections:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId) {
         NSLog(@"jxcore: killConnections");

         if (params.count != 2 || ![params[0] isKindOfClass:[NSString class]]) {
             NSLog(@"jxcore: killConnections: badParam");

             @synchronized(self) {
                 [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
             }
         }
         else {
             if ([appContext killConnection: params[0]]) {
                 NSLog(@"jxcore: killConnections: success");

                 @synchronized(self) {
                     [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
                 }
             }
             else {
                 NSLog(@"jxcore: killConnections: fail");

                 @synchronized(self) {
                     [JXcore callEventCallback:callbackId withParams:@[@"Not connected to specified peer"]];
                 }
             }
         }
     } withName:[AppContext killConnections]];
}

- (void)defineDidRegisterToNative:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId)
     {
         if (params.count != 2 || ![params[0] isKindOfClass:[NSString class]]) {
             NSLog(@"jxcore: didRegisterToNative: badParam");
         }
         else {
             [appContext didRegisterToNative: params[0]];
         }
     } withName:[AppContext didRegisterToNative]];
}

- (void)defineGetOSVersion:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId) {
         NSString * const version = [appContext getIOSVersion];
         @synchronized(self)
         {
             [JXcore callEventCallback:callbackId withParams:@[version]];
         }
     } withName:[AppContext getOSVersion]];
}

- (void)defineExecuteNativeTests:(AppContext *)appContext
{
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

@end

@implementation JXcoreExtension(AppContextDelegate)

- (void)context:(AppContext * _Nonnull)context didChangePeerAvailability:(NSArray<NSDictionary<NSString *, id> *> * _Nonnull)peers {
    @synchronized(self) {
        [JXcore callEventCallback:[AppContext peerAvailabilityChanged]
                         withJSON:[JXcoreExtension objectToJSON:peers]];
    }
}

- (void)context:(AppContext * _Nonnull)context didChangeNetworkStatus:(NSDictionary<NSString *, id> * _Nonnull)status {
    @synchronized(self) {
        [JXcore callEventCallback:[AppContext networkChanged]
                         withJSON:[JXcoreExtension objectToJSON:status]];
    }
}

- (void)context:(AppContext * _Nonnull)context didUpdateDiscoveryAdvertisingState:(NSDictionary<NSString *, id> * _Nonnull)discoveryAdvertisingState {
    @synchronized(self) {
        [JXcore callEventCallback:[AppContext discoveryAdvertisingStateUpdateNonTCP] 
                         withJSON:[JXcoreExtension objectToJSON:discoveryAdvertisingState]];
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
