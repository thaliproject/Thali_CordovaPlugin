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

- (void)peerAvailabilityChanged:(NSString *)peerJSON;
- (void)networkChanged:(NSString *)json;
- (void)appEnteringBackground;
- (void)appEnteredForeground;

@end

// JavaScript callbacks.
NSString * const kNetworkChanged = @"networkChanged";
NSString * const kPeerAvailabilityChanged = @"peerAvailabilityChanged";
NSString * const kAppEnteringBackground = @"appEnteringBackground";
NSString * const kAppEnteredForeground = @"appEnteredForeground";

@implementation JXcoreExtension

- (void)peerAvailabilityChanged:(NSString *)peerJSON
{
  // Fire the peerAvailabilityChanged event.
  OnMainThread(^{
    [JXcore callEventCallback:kPeerAvailabilityChanged
                     withJSON:peerJSON];
  });
}

- (void)networkChanged:(NSString *)json
{
  // Fire the networkChanged event.
  OnMainThread(^{
      [JXcore callEventCallback:kNetworkChanged
                       withJSON:json];
  });
}

- (void)appEnteringBackground
{
  [JXcore callEventCallback:kAppEnteringBackground withParams:@[]];
}

- (void)appEnteredForeground
{
  [JXcore callEventCallback:kAppEnteredForeground withParams:@[]];
}

// Defines methods.
- (void)defineMethods
{
  THEAppContext *theApp = [THEAppContext singleton];
  [theApp setThaliEventDelegate:self];

  // Export the public API to node

  // startListeningForAdvertisements
  [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) 
  {
    NSLog(@"jxcore: startListeningForAdvertisements");

    if ([theApp startListeningForAdvertisements])
    {
      NSLog(@"jxcore: startListeningForAdvertisements: success");
      [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
    }
    else
    {
      NSLog(@"jxcore: startListeningForAdvertisements: failure");
      [JXcore callEventCallback:callbackId withParams:@[@"Call Stop!"]];
    }
  } withName:@"startListeningForAdvertisements"];

  // StopListeningForAdvertisements
  [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) 
  {
    NSLog(@"jxcore: stopListeningForAdvertisements");

    if ([theApp stopListeningForAdvertisements])
    {
      NSLog(@"jxcore: stopListeningForAdvertisements: success");
      [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
    }
    else
    {
      NSLog(@"jxcore: stopListeningForAdvertisements: failure");
      [JXcore callEventCallback:callbackId withParams:@[@"Unknown Error!"]];
    }
  } withName:@"stopListeningForAdvertisements"];


  // StartUpdateAdvertisingAndListenForIncomingConnections
  [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) 
  {
    NSLog(@"jxcore: startUpdateAdvertisingAndListenForIncomingConnections");

    if ([params count] != 2 || ![params[0] isKindOfClass:[NSNumber class]])
    {
      NSLog(@"jxcore: startUpdateAdvertisingAndListenForIncomingConnections: bad arg");
      [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
    }
    else 
    {
      if ([theApp startUpdateAdvertisingAndListenForIncomingConnections:(unsigned short)params[0]])
      {
        NSLog(@"jxcore: startUpdateAdvertisingAndListenForIncomingConnections: success");
        [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
      }
      else
      {
        NSLog(@"jxcore: startUpdateAdvertisingAndListenForIncomingConnections: failure");
        [JXcore callEventCallback:callbackId withParams:@[@"Unknown Error!"]];
      }
    }
  } withName:@"startUpdateAdvertisingAndListenForIncomingConnections"];

  // StopUpdateAdvertisingAndListenForIncomingConnections
  [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) 
  {
    NSLog(@"jxcore: stopUpdateAdvertisingAndListenForIncomingConnections");

    if ([theApp stopUpdateAdvertisingAndListenForIncomingConnections])
    {
      NSLog(@"jxcore: stopUpdateAdvertisingAndListenForIncomingConnections: success");
      [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
    }
    else
    {
      NSLog(@"jxcore: stopUpdateAdvertisingAndListenForIncomingConnections: failure");
      [JXcore callEventCallback:callbackId withParams:@[@"Unknown Error!"]];
    }
  } withName:@"stopUpdateAdvertisingAndListenForIncomingConnections"];
 
  // Connect
  [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId)
  {
    if ([params count] != 2 || ![params[0] isKindOfClass:[NSString class]])
    {
      NSLog(@"jxcore: connect: badParam");
      [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
    }
    else
    {
      NSLog(@"jxcore: connect %@", params[0]);
      void (^connectCallback)(NSString *, NSString *) = ^(NSString *errorMsg, NSString *connection) 
      {
        if (errorMsg == nil)
        {
          NSLog(@"jxcore: connect: success");
          [JXcore callEventCallback:callbackId withParams:@[[NSNull null], connection]];
        }
        else
        {
          NSLog(@"jxcore: connect: fail: %@", errorMsg);
          [JXcore callEventCallback:callbackId withParams:@[errorMsg, [NSNull null]]];
        }
      };

      // We'll callback to the upper layer when the connect completes or fails
      [theApp connectToPeer:params[0] connectCallback:connectCallback];
    }
  } withName:@"connect"];

  [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId)
  {
    NSLog(@"jxcore: killConnection");

    if ([params count] != 2 || ![params[0] isKindOfClass:[NSString class]])
    {
      NSLog(@"jxcore: killConnection: badParam");
      [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
    }
    else
    {
      if ([theApp killConnection: params[0]])
      {
        NSLog(@"jxcore: killConnection: success");
        [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
      }
      else
      {
        NSLog(@"jxcore: killConnection: fail");
        [JXcore callEventCallback:callbackId withParams:@[@"Not connected to specified peer"]];
      }
    }

  } withName:@"killConnection"];

}

@end
