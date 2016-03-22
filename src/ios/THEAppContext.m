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
#import <CoreBluetooth/CoreBluetooth.h>
#import <SystemConfiguration/CaptiveNetwork.h>

#import "THEAppContext.h"
#import "NPReachability.h"
#import "THEPeerBluetooth.h"
#import "THEMultipeerManager.h"
#import "THEThaliEventDelegate.h"

// THEAppContext (Internal) interface.
@interface THEAppContext (Internal) <CBPeripheralManagerDelegate, CBCentralManagerDelegate>

// ctor
- (id)init;

// Fire peerAvailabilityChanged event
- (void)firePeerAvailabilityChangedEvent:(NSDictionary *)peer;

- (void)fireDiscoveryAdvertisingStateUpdate;

- (void)fireIncomingConnectionToPortNumberFailed:(unsigned short)serverPort;

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
  bool _bleEnabled;
  bool _bluetoothEnabled;

  // Our current app level id
  NSString * _peerIdentifier;
    
  // Peer Bluetooth.
  THEPeerBluetooth * _peerBluetooth;
 
  // Let's us know the BT radio states
  CBPeripheralManager *_btPeripheralManager;
  CBCentralManager *_bleManager;
  
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
  BOOL result = [_multipeerManager startListening];
  [self fireDiscoveryAdvertisingStateUpdate];
  return result;
}

// Stops client components 
- (BOOL)stopListeningForAdvertisements
{
  BOOL result = [_multipeerManager stopListening];
  [self fireDiscoveryAdvertisingStateUpdate];
  return result;
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

// Connects to the peer server with the specified peer identifier.
- (BOOL)connectToPeer:(NSString *)peerIdentifier 
      connectCallback:(ClientConnectCallback)connectCallback
{
  return [_multipeerManager connectToPeerWithPeerIdentifier:peerIdentifier
                                              withConnectCallback:connectCallback];
}

// Kill connection with extreme prejudice, no clean-up, testing only
- (BOOL)killConnections:(NSString *)peerIdentifier
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

// Fires the network changed event.
- (void)fireNetworkChangedEvent
{
  NSDictionary *networkStatus;

  // NPReachability only tells us what kind of IP connection we're capable
  // of. Need to take bluetooth into account also

  /* This stuff is being deprecated. Hmm !!!
  NSArray *ifs = (__bridge_transfer id)CNCopySupportedInterfaces();
  if ([ifs count] > 0)
  {
    for (NSString *ifname in ifs)
    {
      NSDictionary *info = (__bridge_transfer id)CNCopyCurrentNetworkInfo((__bridge CFStringRef)ifname);

    }
  }*/
  
  BOOL isWifi = !([[NPReachability sharedInstance] currentReachabilityFlags] & kSCNetworkReachabilityFlagsIsWWAN);

  networkStatus = @{
    @"bluetoothLowEnergy" : _bleEnabled ? @"on" : @"off",
    @"bluetooth" : _bluetoothEnabled ? @"on" : @"off",
    @"cellular" : @"doNotCare",
    @"wifi" : isWifi ? @"on" : @"off"
  };

  if (_eventDelegate)
  {
    [_eventDelegate networkChanged: networkStatus];
  }
}

#ifdef DEBUG
- (void)setPeerIdentifier:(NSString *)peerIdentifier
{
  _peerIdentifier = peerIdentifier;
}
#endif

- (void)didNotAcceptConnectionWithServerPort:(unsigned short)serverPort
{
  [self fireIncomingConnectionToPortNumberFailed:serverPort];
}

///////////////////////////////////////////////////////////
// THEAppContext (THEPeerBluetoothDelegate) implementation.
///////////////////////////////////////////////////////////

// Receive notifications from the bluetooth stack about radio state
- (void)peerBluetooth:(THEPeerBluetooth *)peerBluetooth didUpdateState:(BOOL)bluetoothEnabled
{
  // NOOP for now  - We're doing this ourselves.
}

// Notifies the delegate that a peer was connected.
- (void)peerBluetooth:(THEPeerBluetooth *)peerBluetooth
didConnectPeerIdentifier:(NSString *)peerIdentifier
                peerName:(NSString *)peerName
{
  // NOOP for now
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

  // We don't really know yet, assume the worst, we'll get an update
  // when we initialise the BT stack 
  _bluetoothEnabled = false;
  
  NSDictionary<NSString *, id> *options = @{CBCentralManagerOptionShowPowerAlertKey:@0};
  _btPeripheralManager = [[CBPeripheralManager alloc] initWithDelegate:self queue:nil options:options];
  
  _bleManager = [[CBCentralManager alloc] initWithDelegate:self queue:nil];
  
  _multipeerManager = [[THEMultipeerManager alloc] initWithServiceType:THALI_SERVICE_TYPE
                                                    withPeerIdentifier:_peerIdentifier
                                             withPeerDiscoveryDelegate:self
                                          withRemoteConnectionDelegate:self];
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

- (void)fireIncomingConnectionToPortNumberFailed:(unsigned short)serverPort
{
  [_eventDelegate incomingConnectionToPortNumberFailed:serverPort];
}

- (void)fireDiscoveryAdvertisingStateUpdate
{
  NSDictionary *stateUpdate = @{
    @"discoveryActive" : [[NSNumber alloc] initWithBool:[_multipeerManager isListening]],
    @"advertisingActive" : [[NSNumber alloc] initWithBool:[_multipeerManager isAdvertising]]
  };
  
  [_eventDelegate discoveryAdvertisingStateUpdate:stateUpdate];
}

- (void)firePeerAvailabilityChangedEvent:(NSDictionary *)peer
{
  if (_eventDelegate)
  {
    // delegate expects an array of peers
    NSArray *peerArray = [[NSArray alloc] initWithObjects:peer, nil];
    [_eventDelegate peerAvailabilityChanged:peerArray];
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

- (void)peripheralManagerDidUpdateState:(CBPeripheralManager *)peripheral
{
  switch (peripheral.state)
  {
    case CBPeripheralManagerStatePoweredOn:
    {
      _bluetoothEnabled = true;
    }
    break;
      
    default:
    {
      _bluetoothEnabled = false;
    }
    break;
  }
  
  [self fireNetworkChangedEvent];
}

- (void)centralManagerDidUpdateState:(CBCentralManager *)central
{
  switch (central.state)
  {
    case CBCentralManagerStatePoweredOn:
      _bleEnabled = true;
      
    default:
      _bleEnabled = false;
  }
  
  [self fireNetworkChangedEvent];
}

@end
