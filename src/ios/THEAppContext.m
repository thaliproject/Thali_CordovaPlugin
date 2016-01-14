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

#import <pthread.h>
#import "THEAtomicFlag.h"
#import "THEThreading.h"
#import "NPReachability.h"
#import "THEPeerBluetooth.h"
#import "THEMultipeerClient.h"
#import "THEMultipeerServer.h"
#import "THEAppContext.h"
#import "THEPeer.h"
#import "THEThaliEventDelegate.h"


// THEAppContext (Internal) interface.
@interface THEAppContext (Internal)

// ctor
- (id)init;

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
  // the event delegate to which we'll deliver key events
  id<THEThaliEventDelegate> _eventDelegate;
  
  // true if we're listening for advertisements
  THEAtomicFlag * _isListening;

  // true if we're advertising
  THEAtomicFlag * _isAdvertising;
  
  // MORIBUND  
  THEAtomicFlag * _atomicFlagCommunicationsEnabled;

  // The reachability handler reference.
  id reachabilityHandlerReference;

  // Bluetooth enabled state
  bool _bluetoothEnabled;

  // MPCF peer ID
  MCPeerID * _peerID;
 
  // Our current app level id
  NSString * _peerIdentifier;
    
  // Peer Bluetooth.
  THEPeerBluetooth * _peerBluetooth;
 
  // The multipeer client which will handle browsing and connecting for us
  THEMultipeerClient *_client;

  // The multipeer server which will handle advertising out service and accepting 
  // connections from remote clients
  THEMultipeerServer *_server;
   
  // The mutex used to protect access to things below.
  pthread_mutex_t _mutex;
    
  // The peers dictionary.
  NSMutableDictionary * _peers;
}

// CONSTANTS
static NSString *const THALI_SERVICE_TYPE = @"Thali";
static NSString *const BLE_SERVICE_TYPE = @"72D83A8B-9BE7-474B-8D2E-556653063A5B";

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

- (void)setThaliEventDelegate:(id)eventDelegate
{
  _eventDelegate = eventDelegate;
}

// Starts up the client components
- (BOOL)startListeningForAdvertisements
{
  if ([_isListening isClear])
  {
    if ([_isListening trySet])
    {
      _client = [[THEMultipeerClient alloc] 
                          initWithPeerId:_peerID
                      withPeerIdentifier:_peerIdentifier
                         withServiceType:THALI_SERVICE_TYPE
                   withDiscoveryDelegate:self];

      [_client start];

      return true;
    }
  }

  return false;
}

// Stops client components 
- (BOOL)stopListeningForAdvertisements
{
  if ([_isListening isSet])
  {
    if ([_isListening tryClear])
    {
      // Stop
      [_client stop];
    }
  }

  return true;
}

// Starts up the server components
- (BOOL)startUpdateAdvertisingAndListenForIncomingConnections:(unsigned short)serverPort
{
  if ([_isAdvertising isClear])
  {
    if ([_isAdvertising trySet])
    {
      // Start up the server   
      _server = [[THEMultipeerServer alloc] initWithPeerId: _peerID 
                    withPeerIdentifier: _peerIdentifier
                        withServerPort: serverPort
                       withServiceType: THALI_SERVICE_TYPE];

      [_server start];
    }
  }
  else
  {
    // Update
  }

  return true;
}

// Stops server components
- (BOOL)stopUpdateAdvertisingAndListenForIncomingConnections
{
  if ([_isAdvertising isSet])
  {
    // Stop
    if ([_isAdvertising tryClear])
    {
      [_server stop];
    }
  }

  return true;
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
      connectCallback:(void(^)(NSString *, uint))connectCallback
{
  if ([_atomicFlagCommunicationsEnabled isClear])
  {
      NSLog(@"Communications not enabled");
      connectCallback(@"app: Not initialised", 0);
      return NO;
  }

  return [_client connectToPeerWithPeerIdentifier:peerIdentifier
                              withConnectCallback:(void(^)(NSString *, uint))connectCallback];
}

// Disconnects from the peer server with the specified peer identifier.
- (BOOL)disconnectFromPeer:(NSString *)peerIdentifier
{
  // If communications are not enabled, return NO.
  if ([_atomicFlagCommunicationsEnabled isClear])
  {
    NSLog(@"Communications not enabled");
    return NO;
  }
    
  return [_client disconnectFromPeerWithPeerIdentifier:peerIdentifier];
}

// Kill connection with extreme prejudice, no clean-up, testing only
- (BOOL)killConnection:(NSString *)peerIdentifier
{
  if ([_atomicFlagCommunicationsEnabled isClear])
  {
    NSLog(@"Communications not enabled");
    return NO;
  }

  return [_client killConnection:peerIdentifier];
}

////////////////////////////////////////////////////////////
// THEAppContext <THEMultipeerDiscoveryDelegate> implementation.
////////////////////////////////////////////////////////////

- (void)didFindPeerIdentifier:(NSString *)peerIdentifier peerName:(NSString *)peerName
{
  // Lock.
  pthread_mutex_lock(&_mutex);
  
  // Find the peer.
  THEPeer * peer = _peers[peerIdentifier];
  
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

  if (_eventDelegate)
  {
    [_eventDelegate peerAvailabilityChanged:[peer JSON]];
  }
}

- (void)didLosePeerIdentifier:(NSString *)peerIdentifier
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
    if (_eventDelegate)
    {
      [_eventDelegate peerAvailabilityChanged:[peer JSON]];
    }
  }
}

///////////////////////////////////////////////////////////
// THEAppContext (THEPeerBluetoothDelegate) implementation.
///////////////////////////////////////////////////////////

// Receive notifications from the bluetooth stack about radio state
- (void)peerBluetooth:(THEPeerBluetooth *)peerBluetooth didUpdateState:(BOOL)bluetoothEnabled
{
  pthread_mutex_lock(&_mutex);

  // This will always be called regardless of BT state
  _bluetoothEnabled = bluetoothEnabled;
  [self fireNetworkChangedEvent];

  pthread_mutex_unlock(&_mutex);
}

// Notifies the delegate that a peer was connected.
- (void)peerBluetooth:(THEPeerBluetooth *)peerBluetooth
didConnectPeerIdentifier:(NSString *)peerIdentifier
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

  if (_eventDelegate)
  {
    [_eventDelegate peerAvailabilityChanged:[peer JSON]];
  }
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
  _peerID = [[MCPeerID alloc] initWithDisplayName: [[UIDevice currentDevice] name]];

  _isListening = [[THEAtomicFlag alloc] init];
  _isAdvertising = [[THEAtomicFlag alloc] init];
 
  // We don't really know yet, assum the worst, we'll get an update
  // when we initialise the BT stack 
  _bluetoothEnabled = false;
  
  // Initialize the the mutex 
  pthread_mutex_init(&_mutex, NULL);

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
