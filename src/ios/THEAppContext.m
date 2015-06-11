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
//  ThaliMobile
//  THEAppContext.m
//

#import <pthread.h>
#include "jx.h"
#import "JXcore.h"
#import <TSNAtomicFlag.h>
#import <TSNThreading.h>
#import <NPReachability.h>
#import "THEPeerBluetooth.h"
#import "THEPeerNetworking.h"
#import "THEAppContext.h"
#import "THEPeer.h"

// JavaScript callbacks.
NSString * const kPeerAvailabilityChanged   = @"peerAvailabilityChanged";
NSString * const kConnectingToPeerServer    = @"connectingToPeerServer";
NSString * const kConnectedToPeerServer     = @"connectedToPeerServer";
NSString * const kNotConnectedToPeerServer  = @"notConnectedToPeerServer";
NSString * const kPeerClientConnecting      = @"peerClientConnecting";
NSString * const kPeerClientConnected       = @"peerClientConnected";
NSString * const kPeerClientNotConnected    = @"peerClientNotConnected";

// THEAppContext (THEPeerBluetoothDelegate) interface.
@interface THEAppContext (THEPeerBluetoothDelegate)
@end

// THEAppContext (THEPeerNetworkingDelegate) interface.
@interface THEAppContext (THEPeerNetworkingDelegate)
@end

// THEAppContext (Internal) interface.
@interface THEAppContext (Internal)

// Class initializer.
- (instancetype)init;

// Fires the network changed event.
- (void)fireNetworkChangedEvent;

// UIApplicationWillResignActiveNotification callback.
- (void)applicationWillResignActiveNotification:(NSNotification *)notification;

// UIApplicationDidBecomeActiveNotification callback.
- (void)applicationDidBecomeActiveNotification:(NSNotification *)notification;

@end

// THEAppContext implementation.
@implementation THEAppContext
{
@private
    // The communications enabled atomic flag.
    TSNAtomicFlag * _atomicFlagCommunicationsEnabled;
    
    // The reachability handler reference.
    id reachabilityHandlerReference;
    
    // Peer Bluetooth.
    THEPeerBluetooth * _peerBluetooth;
    
    // Peer Networking.
    THEPeerNetworking * _peerNetworking;
    
    // The mutex used to protect access to things below.
    pthread_mutex_t _mutex;
    
    // The peers dictionary.
    NSMutableDictionary * _peers;
}

// Singleton.
+ (instancetype)singleton
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

// Defines JavaScript extensions.
- (void)defineJavaScriptExtensions
{
    // GetDeviceName native block.
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
        [JXcore callEventCallback:callbackId
                       withParams:@[[[UIDevice currentDevice] name]]];
    } withName:@"GetDeviceName"];
    
    // MakeGUID native block.
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
        [JXcore callEventCallback:callbackId
                       withParams:@[[[NSUUID UUID] UUIDString]]];
    } withName:@"MakeGUID"];

    // GetKeyValue native block.
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
        if ([params count] != 2 || ![params[0] isKindOfClass:[NSString class]])
        {
            [JXcore callEventCallback:callbackId
                             withParams:@[]];
        }
        else
        {
            NSString * value = [[NSUserDefaults standardUserDefaults] stringForKey:params[0]];
            [JXcore callEventCallback:callbackId
                           withParams:value ? @[value] : @[]];
        }
    } withName:@"GetKeyValue"];
    
    // SetKeyValue native block.
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
        if ([params count] != 3 || ![params[0] isKindOfClass:[NSString class]] || ![params[1] isKindOfClass:[NSString class]])
        {
            [JXcore callEventCallback:callbackId
                           withParams:@[]];
        }
        else
        {
            NSUserDefaults * userDefaults = [NSUserDefaults standardUserDefaults];
            [userDefaults setObject:params[1]
                             forKey:params[0]];
            [userDefaults synchronize];
            [JXcore callEventCallback:callbackId
                           withParams:@[params[1]]];
        }
    } withName:@"SetKeyValue"];
    
    // NotifyUser native block.
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
        if ([params count] != 3 || ![params[0] isKindOfClass:[NSString class]] || ![params[1] isKindOfClass:[NSString class]])
        {
            // Done.
            [JXcore callEventCallback:callbackId
                           withParams:@[@(false)]];
        }
        else
        {
            // If the application is not active, post a local notification.
            if ([[UIApplication sharedApplication] applicationState] != UIApplicationStateActive)
            {
                UILocalNotification * localNotification = [[UILocalNotification alloc] init];
                [localNotification setFireDate:[[NSDate alloc] init]];
                [localNotification setAlertTitle:params[0]];
                [localNotification setAlertBody:params[1]];
                [localNotification setSoundName:UILocalNotificationDefaultSoundName];
                [[UIApplication sharedApplication] scheduleLocalNotification:localNotification];
            }
            else
            {
                // The application is active, do something else. TODO.
            }

            // Done.
            [JXcore callEventCallback:callbackId
                           withParams:@[@(true)]];
        }
    } withName:@"NotifyUser"];
    
    // StartPeerCommunications native block.
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
        if ([params count] != 3 || ![params[0] isKindOfClass:[NSString class]] || ![params[1] isKindOfClass:[NSString class]])
        {
            [JXcore callEventCallback:callbackId
                           withParams:@[@(false)]];
        }
        else
        {
            [self startCommunicationsWithPeerIdentifier:[[NSUUID alloc] initWithUUIDString:params[0]]
                                               peerName:params[1]];
            [JXcore callEventCallback:callbackId
                           withParams:@[@(true)]];
        }
    } withName:@"StartPeerCommunications"];
    
    // StopPeerCommunications native block.
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
        [self stopCommunications];
        [JXcore callEventCallback:callbackId
                       withParams:nil];
    } withName:@"StopPeerCommunications"];

    // BeginConnectToPeerServer native block.
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
        // Obtain the peer identifier.
        NSString * peerIdentifier = params[0];
        
        // Connect to the the peer server.
        BOOL result = [self connectToPeerServerWithPeerIdentifier:[[NSUUID alloc] initWithUUIDString:peerIdentifier]];
        
        // Return the result.
        [JXcore callEventCallback:callbackId
                       withParams:@[@(result)]];
    } withName:@"BeginConnectToPeerServer"];
    
    // DisconnectPeerServer native block.
    [JXcore addNativeBlock:^(NSArray * params, NSString * callbackId) {
        // Obtain the peer identifier.
        NSString * peerIdentifier = params[0];
        
        // Disconnect from the peer server.
        BOOL result = [self disconnectFromPeerServerWithPeerIdentifier:[[NSUUID alloc] initWithUUIDString:peerIdentifier]];
        
        // Return the result.
        [JXcore callEventCallback:callbackId
                       withParams:@[@(result)]];
    } withName:@"DisconnectFromPeerServer"];
}

// Starts communications.
- (void)startCommunicationsWithPeerIdentifier:(NSUUID *)peerIdentifier
                                     peerName:(NSString *)peerName
{
    if ([_atomicFlagCommunicationsEnabled trySet])
    {
        // Allocate and initialize the service type.
        NSUUID * serviceType = [[NSUUID alloc] initWithUUIDString:@"72D83A8B-9BE7-474B-8D2E-556653063A5B"];

        // Allocate and initialize the peer Bluetooth context.
        _peerBluetooth = [[THEPeerBluetooth alloc] initWithServiceType:serviceType
                                                        peerIdentifier:peerIdentifier
                                                              peerName:peerName];
        [_peerBluetooth setDelegate:(id<THEPeerBluetoothDelegate>)self];
        
        // Allocate and initialize peer networking.
        _peerNetworking = [[THEPeerNetworking alloc] initWithServiceType:@"Thali"
                                                          peerIdentifier:peerIdentifier
                                                                peerName:peerName];
        [_peerNetworking setDelegate:(id<THEPeerNetworkingDelegate>)self];

        // Start peer Bluetooth and peer networking.
        [_peerBluetooth start];
        [_peerNetworking start];
        
        // Once started, fire the network changed event.
        OnMainThreadAfterTimeInterval(1.0, ^{
            [self fireNetworkChangedEvent];
            reachabilityHandlerReference = [[NPReachability sharedInstance] addHandler:^(NPReachability * reachability) {
                [self fireNetworkChangedEvent];
            }];
        });
    }
}

// Stops communications.
- (void)stopCommunications
{
    if ([_atomicFlagCommunicationsEnabled tryClear])
    {
        [_peerBluetooth stop];
        [_peerNetworking stop];
        [_peerBluetooth setDelegate:nil];
        [_peerNetworking setDelegate:nil];
        _peerBluetooth = nil;
        _peerNetworking = nil;
        [[NPReachability sharedInstance] removeHandler:reachabilityHandlerReference];
        reachabilityHandlerReference = nil;
    }
}

// Connects to the peer server with the specified peer idetifier.
- (BOOL)connectToPeerServerWithPeerIdentifier:(NSUUID *)peerIdentifier
{
    // If communications are not enabled, return NO.
    if ([_atomicFlagCommunicationsEnabled isClear])
    {
        return NO;
    }
    
    // Lock.
    pthread_mutex_lock(&_mutex);
    
    // Find the peer.
    THEPeer * peer = [_peers objectForKey:peerIdentifier];
    
    // Unlock.
    pthread_mutex_unlock(&_mutex);
    
    // If we didn't find the peer, return NO.
    if (!peer)
    {
        return NO;
    }

    // Connect the peer and return YES, indicating that we started the connection process.
    [_peerNetworking connectToPeerServerWithPeerIdentifier:peerIdentifier];
    return YES;
}

// Disconnects from the peer server with the specified peer idetifier.
- (BOOL)disconnectFromPeerServerWithPeerIdentifier:(NSUUID *)peerIdentifier
{
    // If communications are not enabled, return NO.
    if ([_atomicFlagCommunicationsEnabled isClear])
    {
        return NO;
    }
    
    // Lock.
    pthread_mutex_lock(&_mutex);
    
    // Find the peer. If we didn't find it, return NO.
    THEPeer * peer = [_peers objectForKey:peerIdentifier];

    // Unlock.
    pthread_mutex_unlock(&_mutex);

    // If we didn't find the peer, return NO.
    if (!peer)
    {
        return NO;
    }

    // Disconnect the peer with the specified peer identifier.
    [_peerNetworking disconnectFromPeerServerWithPeerIdentifier:peerIdentifier];
    return YES;
}

@end

// THEAppContext (THEPeerBluetoothDelegate) implementation.
@implementation THEAppContext (THEPeerBluetoothDelegate)

// Notifies the delegate that a peer was connected.
- (void)peerBluetooth:(THEPeerBluetooth *)peerBluetooth
didConnectPeerIdentifier:(NSUUID *)peerIdentifier
             peerName:(NSString *)peerName
{
    // Lock.
    pthread_mutex_lock(&_mutex);

    // Find the peer. If we found it, simply return.
    THEPeer * peer = [_peers objectForKey:peerIdentifier];
    if (peer)
    {
        pthread_mutex_unlock(&_mutex);
        return;
    }
    
    // Allocate and initialize the peer.
    peer = [[THEPeer alloc] initWithIdentifier:peerIdentifier
                                          name:peerName];
    [_peers setObject:peer
               forKey:peerIdentifier];

    // Unlock.
    pthread_mutex_unlock(&_mutex);

    // Fire the peerAvailabilityChanged event.
    OnMainThread(^{
        [JXcore callEventCallback:kPeerAvailabilityChanged
                         withJSON:[peer JSON]];
    });
}

// Notifies the delegate that a peer was disconnected.
- (void)peerBluetooth:(THEPeerBluetooth *)peerBluetooth
didDisconnectPeerIdentifier:(NSUUID *)peerIdentifier
{
}

@end

// THEAppContext (THEPeerNetworkingDelegate) implementation.
@implementation THEAppContext (THEPeerNetworkingDelegate)

// Notifies the delegate that a peer was found.
- (void)peerNetworking:(THEPeerNetworking *)peerNetworking
 didFindPeerIdentifier:(NSUUID *)peerIdentifier
              peerName:(NSString *)peerName
{
    // Lock.
    pthread_mutex_lock(&_mutex);
    
    // Find the peer.
    THEPeer * peer = [_peers objectForKey:peerIdentifier];
    
    // If this is a new peer, add it.
    if (!peer)
    {
        // Allocate and initialize the peer, add it to the peers dictionary.
        peer = [[THEPeer alloc] initWithIdentifier:peerIdentifier
                                              name:peerName];
        [_peers setObject:peer
                   forKey:peerIdentifier];
    }
    
    // Update the peer state.
    [peer setAvailable:YES];
    
    // Unlock.
    pthread_mutex_unlock(&_mutex);

    // Fire the peerAvailabilityChanged event.
    OnMainThread(^{
        [JXcore callEventCallback:kPeerAvailabilityChanged
                         withJSON:[peer JSON]];
    });
}

// Notifies the delegate that a peer was lost.
- (void)peerNetworking:(THEPeerNetworking *)peerNetworking
 didLosePeerIdentifier:(NSUUID *)peerIdentifier
{
    // Lock.
    pthread_mutex_lock(&_mutex);
    
    // Find the peer.
    THEPeer * peer = _peers[peerIdentifier];
    if (peer)
    {
        [peer setAvailable:NO];
    }
    
    // Unlock.
    pthread_mutex_unlock(&_mutex);
    
    // Fire the peerAvailabilityChanged event.
    if (peer)
    {
        OnMainThread(^{
            [JXcore callEventCallback:kPeerAvailabilityChanged
                             withJSON:[peer JSON]];
        });
    }
}


// Notifies the delegate that the peer networking client is connecting to the specified peer networking server.
- (void)peerNetworking:(THEPeerNetworking *)peerNetworking
connectingToPeerServerWithPeerIdentifier:(NSUUID *)peerIdentifier
{
    // Lock.
    pthread_mutex_lock(&_mutex);
    
    // Find the peer.
    THEPeer * peer = _peers[peerIdentifier];
    
    // Unlock.
    pthread_mutex_unlock(&_mutex);
    
    // Fire the peerConnecting event.
    if (peer)
    {
        OnMainThread(^{
            [JXcore callEventCallback:kConnectingToPeerServer
                           withParams:@[[[peer identifier] UUIDString]]];
        });
    }
}

// Notifies the delegate that the peer networking client is connected to the specified peer networking server.
- (void)peerNetworking:(THEPeerNetworking *)peerNetworking
connectedToPeerServerWithPeerIdentifier:(NSUUID *)peerIdentifier
{
    // Lock.
    pthread_mutex_lock(&_mutex);
    
    // Find the peer.
    THEPeer * peer = _peers[peerIdentifier];
    
    // Unlock.
    pthread_mutex_unlock(&_mutex);
    
    // Fire the peerConnecting event.
    if (peer)
    {
        OnMainThread(^{
            [JXcore callEventCallback:kConnectedToPeerServer
                           withParams:@[[[peer identifier] UUIDString]]];
        });
    }
}

// Notifies the delegate that peer networking client is not connected to the specified peer networking server.
- (void)peerNetworking:(THEPeerNetworking *)peerNetworking
notConnectedToPeerServerWithPeerIdentifier:(NSUUID *)peerIdentifier
{
    // Lock.
    pthread_mutex_lock(&_mutex);
    
    // Find the peer.
    THEPeer * peer = _peers[peerIdentifier];
    
    // Unlock.
    pthread_mutex_unlock(&_mutex);
    
    // Fire the peerConnecting event.
    if (peer)
    {
        OnMainThread(^{
            [JXcore callEventCallback:kNotConnectedToPeerServer
                           withParams:@[[[peer identifier] UUIDString]]];
        });
    }
}

// Notifies the delegate that the specified peer networking client is connecting to the peer networking server.
- (void)peerNetworking:(THEPeerNetworking *)peerNetworking
peerClientConnectingWithPeerIdentifier:(NSUUID *)peerIdentifier
{
    // Lock.
    pthread_mutex_lock(&_mutex);
    
    // Find the peer.
    THEPeer * peer = _peers[peerIdentifier];
    
    // Unlock.
    pthread_mutex_unlock(&_mutex);
    
    // Fire the peerConnecting event.
    if (peer)
    {
        OnMainThread(^{
            [JXcore callEventCallback:kPeerClientConnecting
                           withParams:@[[[peer identifier] UUIDString]]];
        });
    }
}

// Notifies the delegate that the specified peer networking client is connected to the peer networking server.
- (void)peerNetworking:(THEPeerNetworking *)peerNetworking
peerClientConnectedWithPeerIdentifier:(NSUUID *)peerIdentifier
{
    // Lock.
    pthread_mutex_lock(&_mutex);
    
    // Find the peer.
    THEPeer * peer = _peers[peerIdentifier];
    
    // Unlock.
    pthread_mutex_unlock(&_mutex);
    
    // Fire the peerConnecting event.
    if (peer)
    {
        OnMainThread(^{
            [JXcore callEventCallback:kPeerClientConnected
                           withParams:@[[[peer identifier] UUIDString]]];
        });
    }
}

// Notifies the delegate that the specified peer networking client is not connected to the peer networking server.
- (void)peerNetworking:(THEPeerNetworking *)peerNetworking
peerClientNotConnectedWithPeerIdentifier:(NSUUID *)peerIdentifier
{
    // Lock.
    pthread_mutex_lock(&_mutex);
    
    // Find the peer.
    THEPeer * peer = _peers[peerIdentifier];
    
    // Unlock.
    pthread_mutex_unlock(&_mutex);
    
    // Fire the peerConnecting event.
    if (peer)
    {
        OnMainThread(^{
            [JXcore callEventCallback:kPeerClientNotConnected
                           withParams:@[[[peer identifier] UUIDString]]];
        });
    }
}

@end

// THEAppContext (Internal) implementation.
@implementation THEAppContext (Internal)

// Class initializer.
- (instancetype)init
{
    // Initialize superclass.
    self = [super init];
    
    // Handle errors.
    if (!self)
    {
        return nil;
    }
    
    // Intialize.
    _atomicFlagCommunicationsEnabled = [[TSNAtomicFlag alloc] init];
    
    // Allocate and initialize the service type.
    NSUUID * serviceType = [[NSUUID alloc] initWithUUIDString:@"72D83A8B-9BE7-474B-8D2E-556653063A5B"];
    
    // Static declarations.
    static NSString * const PEER_IDENTIFIER_KEY = @"PeerIdentifierKey";
    
    // Obtain user defaults and see if we have a serialized peer identifier. If we do,
    // deserialize it. If not, make one and serialize it for later use.
    NSUserDefaults * userDefaults = [NSUserDefaults standardUserDefaults];
    NSData * peerIdentifierData = [userDefaults dataForKey:PEER_IDENTIFIER_KEY];
    if (!peerIdentifierData)
    {
        // Create a new peer identifier.
        UInt8 uuid[16];
        [[NSUUID UUID] getUUIDBytes:uuid];
        peerIdentifierData = [NSData dataWithBytes:uuid
                                            length:sizeof(uuid)];
        
        // Save the peer identifier in user defaults.
        [userDefaults setValue:peerIdentifierData
                        forKey:PEER_IDENTIFIER_KEY];
        [userDefaults synchronize];
    }
    NSUUID * peerIdentifier = [[NSUUID alloc] initWithUUIDBytes:[peerIdentifierData bytes]];
    
    // Allocate and initialize the peer Bluetooth context.
    _peerBluetooth = [[THEPeerBluetooth alloc] initWithServiceType:serviceType
                                                    peerIdentifier:peerIdentifier
                                                          peerName:[[UIDevice currentDevice] name]];
    [_peerBluetooth setDelegate:(id<THEPeerBluetoothDelegate>)self];
    
    // Allocate and initialize peer networking.
    _peerNetworking = [[THEPeerNetworking alloc] initWithServiceType:@"Thali"
                                                      peerIdentifier:peerIdentifier
                                                            peerName:[[UIDevice currentDevice] name]];
    [_peerNetworking setDelegate:(id<THEPeerNetworkingDelegate>)self];
    
    // Initialize the the mutex and peers dictionary.
    pthread_mutex_init(&_mutex, NULL);
    _peers = [[NSMutableDictionary alloc] init];
    
    // Get the default notification center.
    NSNotificationCenter * notificationCenter = [NSNotificationCenter defaultCenter];
    
    // Add our observers for application events.
    [notificationCenter addObserver:self
                           selector:@selector(applicationWillResignActiveNotification:)
                               name:UIApplicationWillResignActiveNotification
                             object:nil];
    [notificationCenter addObserver:self
                           selector:@selector(applicationDidBecomeActiveNotification:)
                               name:UIApplicationDidBecomeActiveNotification
                             object:nil];

    // Done.
    return self;
}

// Fires the network changed event.
- (void)fireNetworkChangedEvent
{
    // Construct the JSON for the networkChanged event.
    NSString * json;
    if ([[NPReachability sharedInstance] isCurrentlyReachable])
    {
        json = [NSString stringWithFormat:@"{ \"isReachable\": %@, \"isWiFi\": %@ }",
                @"true",
                ([[NPReachability sharedInstance] currentReachabilityFlags] & kSCNetworkReachabilityFlagsIsWWAN) == 0 ? @"true" : @"false"];
    }
    else
    {
        json = @"{ \"isReachable\": false }";
    }

    // Fire the networkChanged event.
    OnMainThread(^{
        [JXcore callEventCallback:@"networkChanged"
                         withJSON:json];
    });
}

// UIApplicationWillResignActiveNotification callback.
- (void)applicationWillResignActiveNotification:(NSNotification *)notification
{
    [JXcore callEventCallback:@"appEnteringBackground"
                   withParams:@[]];
}

// UIApplicationDidBecomeActiveNotification callback.
- (void)applicationDidBecomeActiveNotification:(NSNotification *)notification
{
    [JXcore callEventCallback:@"appEnteredForeground"
                   withParams:@[]];
}

@end
