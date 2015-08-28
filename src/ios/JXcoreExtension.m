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

#import "JXcoreExtension.h"
#import "THEAppContext.h"

#import "JXcore.h"

// JXcoreExtension implementation.
@implementation JXcoreExtension

// Defines methods.
- (void)defineMethods
{
  THEAppContext *theApp = [THEAppContext singleton];

  // Export the public API to node

  // StartBroadcasting
  [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) 
  {
    NSLog(@"jxcore: startBroadcasting");

    if ([params count] != 3 || ![params[0] isKindOfClass:[NSString class]] || 
        ![params[1] isKindOfClass:[NSNumber class]])
    {
      NSLog(@"jxcore: startBroadcasting: badParam");
      [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
    }
    else
    {
      if ([theApp startBroadcasting:params[0] serverPort:params[1]])
      {
        NSLog(@"jxcore: startBroadcasting: success");
        [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
      }
      else
      {
        NSLog(@"jxcore: startBroadcasting: failure");
        [JXcore callEventCallback:callbackId withParams:@[@"Already broadcasting"]];
      }
    }
  } withName:@"StartBroadcasting"];

    
  // StopBroadcasting
  [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) 
  {
    NSLog(@"jxcore: stopBroadcasting");

    if ([theApp stopBroadcasting])
    {
      NSLog(@"jxcore: stopBroadcasting: success");
      [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
    }
    else
    {
      NSLog(@"jxcore: stopBroadcasting: failure");
      [JXcore callEventCallback:callbackId withParams:@[@"Not broadcasting"]];
    }
  } withName:@"StopBroadcasting"];


  // Connect
  [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId)
  {
    NSLog(@"jxcore: connect");

    if ([params count] != 2 || ![params[0] isKindOfClass:[NSString class]])
    {
      NSLog(@"jxcore: connect: badParam");
      [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
    }
    else
    {
      void (^connectCallback)(NSString *, uint) = ^(NSString *errorMsg, uint port) 
      {
        if (errorMsg == nil)
        {
          NSLog(@"jxcore: connect: success");
          [JXcore callEventCallback:callbackId withParams:@[[NSNull null], @(port)]];
        }
        else
        {
          NSLog(@"jxcore: connect: fail: %@", errorMsg);
          [JXcore callEventCallback:callbackId withParams:@[errorMsg, @(port)]];
        }
      };

      // We'll callback to the upper layer when the connect completes or fails
      [theApp connectToPeer:params[0] connectCallback:connectCallback];
    }
  } withName:@"Connect"];

  // Disconnect
  [JXcore addNativeBlock:^(NSArray * params, NSString *callbackId)
  {
    NSLog(@"jxcore: disconnect");

    if ([params count] != 2 || ![params[0] isKindOfClass:[NSString class]])
    {
      NSLog(@"jxcore: disconnect: badParam");
      [JXcore callEventCallback:callbackId withParams:@[@"Bad argument"]];
    }
    else
    {
      if ([theApp disconnectFromPeer: params[0]])
      {
        NSLog(@"jxcore: disconnect: success");
        [JXcore callEventCallback:callbackId withParams:@[[NSNull null]]];
      }
      else
      {
        NSLog(@"jxcore: disconnect: fail");
        [JXcore callEventCallback:callbackId withParams:@[@"Not connected to specified peer"]];
      }
    }
  } withName:@"Disconnect"];

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

  } withName:@"KillConnection"];

}

@end
