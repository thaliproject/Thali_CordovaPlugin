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
//  THEAppContext.m
//

#import <UIKit/UIKit.h>

#import "THEAppContext.h"
#import "NPReachability.h"
#import "THEPeerBluetooth.h"
#import "THEMultipeerManager.h"
#import "THEThaliEventDelegate.h"

// THEAppContext (Internal) interface.
@interface THEAppContext (Internal)

// ctor
- (id)init;

// Fires the network changed event.
- (void)fireNetworkChangedEvent;

// Fire peerAvailabilityChanged event
- (void)firePeerAvailabilityChangedEvent:(NSDictionary *)peer;

// UIApplicationWillResignActiveNotification callback.
- (void)applicationWillResignActiveNotification:(NSNotification *)notification;

// UIApplicationDidBecomeActiveNotification callback.
- (void)applicationDidBecomeActiveNotification:(NSNotification *)notification;

@end

// THEAppContext implementation.
@implementation THEAppContext
{
@private
  // the event delegate to which we'll deliver key events
  id<THEThaliEventDelegate> _eventDelegate;
 
  // The reachability handler reference.
  id reachabilityHandlerReference;

  // Bluetooth enabled state
  bool _bluetoothEnabled;

  // Our current app level id
  NSString * _peerIdentifier;
    
  // Peer Bluetooth.
  THEPeerBluetooth * _peerBluetooth;
 
  // The multipeer manager, co-ordinates client and server
  THEMultipeerManager *_multipeerManager;

  // The mutex used to protect access to things below.
  pthread_mutex_t _mutex;
    
  // The peers dictionary.
  NSMutableDictionary * _peers;
}

// CONSTANTS
static NSString *const THALI_SERVICE_TYPE = @"thaliproject";
static NSString *const BLE_SERVICE_TYPE = @"72D83A8B-9BE7-474B-8D2E-556653063A5B";

// Singleton.
- (void)setThaliEventDelegate:(id)eventDelegate
{
  _eventDelegate = eventDelegate;
}

// Starts up the client components
- (BOOL)startListeningForAdvertisements
{
  return [_multipeerManager startListening];
}

// Stops client components 
- (BOOL)stopListeningForAdvertisements
{
  return [_multipeerManager stopListening];
}

// Starts up the server components
- (BOOL)startUpdateAdvertisingAndListening:(unsigned short)serverPort
{
  return [_multipeerManager startServerWithServerPort:serverPort];
}

// Stops server components
- (BOOL)stopAdvertisingAndListening
{
  return [_multipeerManager stopServer];
}

// Starts communications.
- (BOOL)startBroadcasting:(NSString *)peerIdentifier serverPort:(NSNumber *)serverPort
{
  //if ([_atomicFlagCommunicationsEnabled trySet])
  //{
  //  _peerIdentifier = [[NSString alloc] initWithString:peerIdentifier];

    // Somewhere to put our peers
    //_peers = [[NSMutableDictionary alloc] init];

    /*
      Temporarily disable the BLE stack since it's not required for 
      our immediate releases so let's just keep things as simple as they 
      can possibly be - tobe
    */

    // Initialise the BLE stack..
    //NSUUID * btServiceType = [[NSUUID alloc] initWithUUIDString:BLE_SERVICE_TYPE];

    // Bluetooth will start on initialisation
    //_peerBluetooth = [[THEPeerBluetooth alloc] initWithServiceType:btServiceType
    //                                                peerIdentifier:peerIdentifier
    //                                                      peerName:[serverPort stringValue]
    //                                             bluetoothDelegate:self];
       

    // Intitialise the multipeer connectivity stack..
    /*_multipeerSession = [[THEMultipeerSession alloc] initWithServiceType:@"Thali"
                                                          peerIdentifier:peerIdentifier
                                                                peerName:[serverPort stringValue]
                                                       discoveryDelegate:self];
    // Start networking..
    [_multipeerSession start];

    // Hook reachability to network changed event (when user
    // toggles Wifi)       
    reachabilityHandlerReference = [[NPReachability sharedInstance] 
      addHandler:^(NPReachability *reachability) {
        [self fireNetworkChangedEvent];
    }];

    return true;
  }
  */
  return false;
}

// Stops communications.
- (BOOL)stopBroadcasting
{
/*  if ([_atomicFlagCommunicationsEnabled tryClear])
  {
    //[_peerBluetooth stop];
    [_multipeerSession stop];

    _peerBluetooth = nil;
    _multipeerSession = nil;

    if (reachabilityHandlerReference != nil) // network changed event may not have fired yet
    {
      [[NPReachability sharedInstance] removeHandler:reachabilityHandlerReference];
      reachabilityHandlerReference = nil;
    }

    _peers = nil;
    return YES;
  }
  */
  NSLog(@"app: didn't stop broadcasting");
  return NO;
}

// Connects to the peer server with the specified peer identifier.
- (BOOL)connectToPeer:(NSString *)peerIdentifier 
      connectCallback:(ClientConnectCallback)connectCallback
{
  return [_multipeerManager connectToPeerWithPeerIdentifier:peerIdentifier
                                              withConnectCallback:connectCallback];
}

// Kill connection with extreme prejudice, no clean-up, testing only
- (BOOL)killConnection:(NSString *)peerIdentifier
{
  return false;
}

- (void)didFindPeer:(NSDictionary *)peer
{
  [self firePeerAvailabilityChangedEvent:peer];
}

- (void)didLosePeer:(NSString *)peerIdentifier
{
}

#ifdef DEBUG
- (void)setPeerIdentifier:(NSString *)peerIdentifier
{
  _peerIdentifier = peerIdentifier;
}
#endif

///////////////////////////////////////////////////////////
// THEAppContext (THEPeerBluetoothDelegate) implementation.
///////////////////////////////////////////////////////////

// Receive notifications from the bluetooth stack about radio state
- (void)peerBluetooth:(THEPeerBluetooth *)peerBluetooth didUpdateState:(BOOL)bluetoothEnabled
{
  @synchronized(self)
  {
    // This will always be called regardless of BT state
    _bluetoothEnabled = bluetoothEnabled;
    [self fireNetworkChangedEvent];
  }
}

// Notifies the delegate that a peer was connected.
- (void)peerBluetooth:(THEPeerBluetooth *)peerBluetooth
didConnectPeerIdentifier:(NSString *)peerIdentifier
                peerName:(NSString *)peerName
{
  @synchronized(self)
  {
  // Find the peer. If we found it, simply return.
/*  THEPeer * peer = [_peers objectForKey:peerIdentifier];
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
*/
  }

  //if (_eventDelegate)
  //{
  //  [_eventDelegate peerAvailabilityChanged:[peer JSON]];
  //}
}

// Notifies the delegate that a peer was disconnected.
- (void)peerBluetooth:(THEPeerBluetooth *)peerBluetooth
didDisconnectPeerIdentifier:(NSString *)peerIdentifier
{
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
    
  _peerIdentifier = [[[NSUUID alloc] init] UUIDString];

  // We don't really know yet, assum the worst, we'll get an update
  // when we initialise the BT stack 
  _bluetoothEnabled = false;
  
  _multipeerManager = [[THEMultipeerManager alloc] initWithServiceType:THALI_SERVICE_TYPE
                                                    withPeerIdentifier:_peerIdentifier
                                             withPeerDiscoveryDelegate:self];
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

- (void)firePeerAvailabilityChangedEvent:(NSDictionary *)peer
{
  if (_eventDelegate)
  {
    NSArray *peerArray = [[NSArray alloc] initWithObjects:peer, nil];
    
    NSString *peerJSON = [[NSString alloc] initWithData:
      [NSJSONSerialization dataWithJSONObject:peerArray options:0 error:nil]
      encoding:NSUTF8StringEncoding
    ];

    [_eventDelegate peerAvailabilityChanged:peerJSON];
  }
}

// Fires the network changed event.
- (void)fireNetworkChangedEvent
{
    NSString * json;

    // NPReachability only tells us what kind of IP connection we're capable
    // of. Need to take bluetooth into account also

    BOOL reachable = [[NPReachability sharedInstance] isCurrentlyReachable] || _bluetoothEnabled;

    if (reachable)
    {
        json = [NSString stringWithFormat:@"{ \"isAvailable\": %@, \"isWiFi\": %@ }",
                @"true", ([[NPReachability sharedInstance] currentReachabilityFlags] & 
                  kSCNetworkReachabilityFlagsIsWWAN) == 0 ? @"true" : @"false"];
    }
    else
    {
        json = @"{ \"isAvailable\": false }";
    }

    if (_eventDelegate)
    {
      [_eventDelegate networkChanged: json];
    }
}

// UIApplicationWillResignActiveNotification callback.
- (void)applicationWillResignActiveNotification:(NSNotification *)notification
{
    if (_eventDelegate)
    {
      [_eventDelegate appEnteringBackground];
    }
}

// UIApplicationDidBecomeActiveNotification callback.
- (void)applicationDidBecomeActiveNotification:(NSNotification *)notification
{
    if (_eventDelegate)
    {
      [_eventDelegate appEnteredForeground];
    }
}

@end
