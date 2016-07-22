//
//  The MIT License (MIT)
//
//  Copyright (c) 2015 Microsoft
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//  THE SOFTWARE.
//
//  Thali CordovaPlugin
//  JXcoreExtension.m
//

#import "JXcore.h"
#import "THEThreading.h"
#import "JXcoreExtension.h"
#import "THEAppContext.h"
#import "THEThaliEventDelegate.h"

// JXcoreExtension implementation.

@interface JXcoreExtension (Internal) <THEThaliEventDelegate>

- (void)networkChanged:(NSString *)json;
- (void)peerAvailabilityChanged:(NSString *)peerJSON;
- (void)discoveryAdvertisingStateUpdate:(NSDictionary *)discoveryAdvertisingState;
- (void)incomingConnectionToPortNumberFailed:(unsigned short)serverPort;

- (void)appEnteringBackground;
- (void)appEnteredForeground;

- (void)didRegisterToNative:(NSString *)name;

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

- (void)networkChanged:(NSDictionary *)networkStatus
{
  @synchronized(self)
  {
    if (_networkChangedRegistered) {
      [JXcore callEventCallback:kNetworkChanged
                       withJSON:[JXcoreExtension objectToJSON:networkStatus]];
    }
  }
}

- (void)peerAvailabilityChanged:(NSArray<NSDictionary *> *)peers
{
  @synchronized(self)
  {
    [JXcore callEventCallback:kPeerAvailabilityChanged
                     withJSON:[JXcoreExtension objectToJSON:peers]];
  }
}

- (void)discoveryAdvertisingStateUpdate:(NSDictionary *)stateUpdate
{
  @synchronized(self)
  {
      [JXcore callEventCallback:kDiscoveryAdvertisingStateUpdate
                       withJSON:[JXcoreExtension objectToJSON:stateUpdate]];
  }
}

- (void)incomingConnectionToPortNumberFailed:(unsigned short)serverPort
{
  @synchronized(self)
  {
      [JXcore callEventCallback:kIncomingConnectionToPortNumberFailed withParams:@[@(serverPort)]];
  }
}

- (void)appEnteringBackground
{
  @synchronized(self)
  {
    [JXcore callEventCallback:kAppEnteringBackground withParams:@[]];
  }
}

- (void)appEnteredForeground
{
  @synchronized(self)
  {
    [JXcore callEventCallback:kAppEnteredForeground withParams:@[]];
  }
}

+ (THEAppContext *)theAppContext
{
  // Singleton instance.
  static THEAppContext * appContext = nil;

  // If unallocated, allocate.
  if (!appContext)
  {
    // Allocator.
    void (^allocator)() = ^
    {
      appContext = [[THEAppContext alloc] init];
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
    [[JXcoreExtension theAppContext] fireNetworkChangedEvent];
  }
}

#pragma mark - Define methods

// Defines methods.
- (void)defineMethods
{
  THEAppContext *theApp = [JXcoreExtension theAppContext];
  [theApp setThaliEventDelegate:self];

  // Export the public API to node

  // startListeningForAdvertisements
  [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId)
  {
    NSLog(@"jxcore: startListeningForAdvertisements");

    if ([theApp startListeningForAdvertisements])
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

  // StopListeningForAdvertisements
  [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId)
  {
    NSLog(@"jxcore: stopListeningForAdvertisements");

    if ([theApp stopListeningForAdvertisements])
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


  // StartUpdateAdvertisingAndListening
  [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId)
  {
    NSLog(@"jxcore: startUpdateAdvertisingAndListening");

    if ([params count] != 2 || ![params[0] isKindOfClass:[NSNumber class]])
    {
      NSLog(@"jxcore: startUpdateAdvertisingAndListening: bad arg");

      @synchronized(self)
      {
        [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
      }
    }
    else
    {
      if ([theApp startUpdateAdvertisingAndListening:(unsigned short)[params[0] intValue]])
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

  // StopUpdateAdvertisingAndListenForIncomingConnections
  [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId)
  {
    NSLog(@"jxcore: stopAdvertisingAndListening");

    if ([theApp stopAdvertisingAndListening])
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

  // Connect
  [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId)
  {
    if ([params count] != 2 || ![params[0] isKindOfClass:[NSString class]])
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
      [theApp connectToPeer:params[0] connectCallback:connectCallback];
    }
  } withName:@"connect"];

  [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId)
  {
    NSLog(@"jxcore: killConnections");

    if ([params count] != 2 || ![params[0] isKindOfClass:[NSString class]])
    {
      NSLog(@"jxcore: killConnections: badParam");

      @synchronized(self)
      {
        [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
      }
    }
    else
    {
      if ([theApp killConnections: params[0]])
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

  // didRegisterToNative - Allow JXCore to inform us that someone registered
  // a JS function to native
  [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId)
  {
    if ([params count] != 2 || ![params[0] isKindOfClass:[NSString class]])
    {
      NSLog(@"jxcore: didRegisterToNative: badParam");
    }
    else
    {
      NSLog(@"jxcore: didRegisterToNative %@", params[0]);
      [self didRegisterToNative: params[0]];
    }
  } withName:@"didRegisterToNative"];


  [self defineGetOSVersion];
  [self defineExecuteNativeTests];
}

- (void)defineGetOSVersion
{
  [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId)
   {
     NSString * const version = [[NSProcessInfo processInfo] operatingSystemVersionString];
     @synchronized(self)
     {
       [JXcore callEventCallback:callbackId withParams:@[version]];
     }
   } withName:@"getOSVersion"];
}

- (void)defineExecuteNativeTests
{
  [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId)
  {
    if ([theApp respondsToSelector:@selector(executeNativeTests)])
    {
      NSString *result = [theApp executeNativeTests];

      @synchronized(self)
      {
        [JXcore callEventCallback:callbackId withParams:@[result]];
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
