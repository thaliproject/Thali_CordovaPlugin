//
//  Thali CordovaPlugin
//  JXcoreExtension.m
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import "JXcore.h"
#import "JXcoreExtension.h"
#import "Thali_CordovaPlugin-swift.h"

// JXcoreExtension implementation.
@interface JXcoreExtension (Internal) <AppContextDelegate>

@end

// JavaScript callbacks.
NSString * const kNetworkChanged = @"networkChanged";
NSString * const kPeerAvailabilityChanged = @"peerAvailabilityChanged";
NSString * const kAppEnteringBackground = @"appEnteringBackground";
NSString * const kAppEnteredForeground = @"appEnteredForeground";
NSString * const kDiscoveryAdvertisingStateUpdate = @"discoveryAdvertisingStateUpdateNonTCP";
NSString * const kIncomingConnectionToPortNumberFailed = @"incomingConnectionToPortNumberFailed";

@implementation JXcoreExtension
{
    BOOL _networkChangedRegistered;
}

- (instancetype)init
{
    if (self = [super init])
    {
        _networkChangedRegistered = NO;
        return self;
    }
    return nil;
}

+ (AppContext *)appContext
{
    // Singleton instance.
    static AppContext * appContext = nil;
    
    // If unallocated, allocate.
    if (!appContext)
    {
        // Allocator.
        void (^allocator)() = ^
        {
            appContext = [[AppContext alloc] init];
        };
        
        // Dispatch allocator once.
        static dispatch_once_t onceToken;
        dispatch_once(&onceToken, allocator);
    }
    
    // Done.
    return appContext;
}

+ (NSString *)objectToJSON:(NSObject *)object
{
    NSError *err = nil;
    NSString *json = [[NSString alloc] initWithData:
                      [NSJSONSerialization dataWithJSONObject:object options:0 error:&err]
                                           encoding:NSUTF8StringEncoding
                      ];
    
    if (err != nil)
    {
        @throw err;
    }
    
    return json;
}

- (void)didRegisterToNative:(NSString *)name
{
    if ([name isEqualToString:kNetworkChanged]) {
        _networkChangedRegistered = YES;
        [[JXcoreExtension appContext] updateNetworkStatus];
    }
}

#pragma mark - Define public API to node methods

// Defines methods.
- (void)defineMethods
{
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
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId)
     {
         NSLog(@"jxcore: startListeningForAdvertisements");
         
         if ([appContext startListeningForAdvertisements])
         {
             NSLog(@"jxcore: startListeningForAdvertisements: success");
             
             @synchronized(self)
             {
                 [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
             }
         }
         else
         {
             NSLog(@"jxcore: startListeningForAdvertisements: failure");
             
             @synchronized(self)
             {
                 [JXcore callEventCallback:callbackId withParams:@[@"Unknown Error!"]];
             }
         }
     } withName:@"startListeningForAdvertisements"];
}

- (void)defineStopListeningForAdvertisements:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId)
     {
         NSLog(@"jxcore: stopListeningForAdvertisements");
         
         if ([appContext stopListeningForAdvertisements])
         {
             NSLog(@"jxcore: stopListeningForAdvertisements: success");
             
             @synchronized(self)
             {
                 [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
             }
         }
         else
         {
             NSLog(@"jxcore: stopListeningForAdvertisements: failure");
             
             @synchronized(self)
             {
                 [JXcore callEventCallback:callbackId withParams:@[@"Unknown Error!"]];
             }
         }
     } withName:@"stopListeningForAdvertisements"];
}

- (void)defineStartUpdateAdvertisingAndListening:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId)
     {
         NSLog(@"jxcore: startUpdateAdvertisingAndListening");
         
         if (params.count != 2 || ![params[0] isKindOfClass:[NSNumber class]])
         {
             NSLog(@"jxcore: startUpdateAdvertisingAndListening: bad arg");
             
             @synchronized(self)
             {
                 [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
             }
         }
         else
         {
             if ([appContext startUpdateAdvertisingAndListeningWithServerPort:(unsigned short)[params[0] intValue]])
             {
                 NSLog(@"jxcore: startUpdateAdvertisingAndListening: success");
                 
                 @synchronized(self)
                 {
                     [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
                 }
             }
             else
             {
                 NSLog(@"jxcore: startUpdateAdvertisingAndListening: failure");
                 
                 @synchronized(self)
                 {
                     [JXcore callEventCallback:callbackId withParams:@[@"Unknown Error!"]];
                 }
             }
         }
     } withName:@"startUpdateAdvertisingAndListening"];
}

- (void)defineStopAdvertisingAndListening:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId)
     {
         NSLog(@"jxcore: stopAdvertisingAndListening");
         
         if ([appContext stopAdvertisingAndListening])
         {
             NSLog(@"jxcore: stopAdvertisingAndListening: success");
             
             @synchronized(self)
             {
                 [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
             }
         }
         else
         {
             NSLog(@"jxcore: stopAdvertisingAndListening: failure");
             
             @synchronized(self)
             {
                 [JXcore callEventCallback:callbackId withParams:@[@"Unknown Error!"]];
             }
         }
     } withName:@"stopAdvertisingAndListening"];
}

- (void)defineConnect:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId)
     {
         if (params.count != 2 || ![params[0] isKindOfClass:[NSString class]])
         {
             NSLog(@"jxcore: connect: badParam");
             
             @synchronized(self)
             {
                 [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
             }
         }
         else
         {
             NSLog(@"jxcore: connect %@", params[0]);
             ClientConnectCallback connectCallback = ^(NSString *errorMsg, NSDictionary *connection)
             {
                 if (errorMsg == nil)
                 {
                     NSLog(@"jxcore: connect: success");
                     
                     @synchronized(self)
                     {
                         [JXcore callEventCallback:callbackId withParams:
                          @[[NSNull null], [JXcoreExtension objectToJSON:connection]]];
                     }
                 }
                 else
                 {
                     NSLog(@"jxcore: connect: fail: %@", errorMsg);
                     
                     @synchronized(self)
                     {
                         [JXcore callEventCallback:callbackId withParams:@[errorMsg, [NSNull null]]];
                     }
                 }
             };
             
             // We'll callback to the upper layer when the connect completes or fails
             [appContext connectToPeer:params[0] callback:connectCallback];
         }
     } withName:@"connect"];
}

- (void)defineKillConnections:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId)
     {
         NSLog(@"jxcore: killConnections");
         
         if (params.count != 2 || ![params[0] isKindOfClass:[NSString class]])
         {
             NSLog(@"jxcore: killConnections: badParam");
             
             @synchronized(self)
             {
                 [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
             }
         }
         else
         {
             if ([appContext killConnection: params[0]])
             {
                 NSLog(@"jxcore: killConnections: success");
                 
                 @synchronized(self)
                 {
                     [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
                 }
             }
             else
             {
                 NSLog(@"jxcore: killConnections: fail");
                 
                 @synchronized(self)
                 {
                     [JXcore callEventCallback:callbackId withParams:@[@"Not connected to specified peer"]];
                 }
             }
         }
     } withName:@"killConnections"];
}

// didRegisterToNative - Allow JXCore to inform us that someone registered
// a JS function to native
- (void)defineDidRegisterToNative:(AppContext *)appContext {
    [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId)
     {
         if (params.count != 2 || ![params[0] isKindOfClass:[NSString class]])
         {
             NSLog(@"jxcore: didRegisterToNative: badParam");
         }
         else
         {
             NSLog(@"jxcore: didRegisterToNative %@", params[0]);
             [self didRegisterToNative: params[0]];
         }
     } withName:@"didRegisterToNative"];
}

- (void)defineGetOSVersion:(AppContext *)appContext
{
    [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId)
     {
         NSString * const version = [[JXcore appContext] getIOSVersion];
         @synchronized(self)
         {
             [JXcore callEventCallback:callbackId withParams:@[version]];
         }
     } withName:@"getOSVersion"];
}

- (void)defineExecuteNativeTests:(AppContext *)appContext
{
    [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId)
     {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wundeclared-selector"
         if ([appContext respondsToSelector:@selector(executeNativeTests)])
         {
             NSString *result = [appContext performSelector:@selector(executeNativeTests)];
#pragma clang diagnostic pop
             
             @synchronized(self)
             {
                 [JXcore callEventCallback:callbackId withJSON:result];
             }
         }
         else
         {
             @synchronized(self)
             {
                 [JXcore callEventCallback:callbackId withParams:@[@"Method not available"]];
             }
         }
     } withName:@"executeNativeTests"];
}

@end

@implementation JXcoreExtension(AppContextDelegate)

- (void)context:(AppContext * _Nonnull)context didChangePeerAvailability:(NSArray<NSDictionary<NSString *, id> *> * _Nonnull)peers {
    @synchronized(self)
    {
        [JXcore callEventCallback:kPeerAvailabilityChanged
                         withJSON:[JXcoreExtension objectToJSON:peers]];
    }
}

- (void)context:(AppContext * _Nonnull)context didChangeNetworkStatus:(NSDictionary<NSString *, id> * _Nonnull)status {
    @synchronized(self)
    {
        if (_networkChangedRegistered) {
            [JXcore callEventCallback:kNetworkChanged
                             withJSON:[JXcoreExtension objectToJSON:status]];
        }
    }
}

- (void)context:(AppContext * _Nonnull)context didUpdateDiscoveryAdvertisingState:(NSDictionary<NSString *, id> * _Nonnull)discoveryAdvertisingState {
    @synchronized(self)
    {
        [JXcore callEventCallback:kDiscoveryAdvertisingStateUpdate
                         withJSON:[JXcoreExtension objectToJSON:discoveryAdvertisingState]];
    }
}

- (void)context:(AppContext * _Nonnull)context didFailIncomingConnectionToPort:(uint16_t)port {
    @synchronized(self)
    {
        [JXcore callEventCallback:kIncomingConnectionToPortNumberFailed withParams:@[@(serverPort)]];
    }
}

- (void)appWillEnterBackgroundWithContext:(AppContext * _Nonnull)context {
    @synchronized(self)
    {
        [JXcore callEventCallback:kAppEnteringBackground withParams:@[]];
    }
}

- (void)appDidEnterForegroundWithContext:(AppContext * _Nonnull)context {
    @synchronized(self)
    {
        [JXcore callEventCallback:kAppEnteredForeground withParams:@[]];
    }
}

@end
