//
//  THEPeerBluetooth.m
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <pthread.h>
#import <CoreBluetooth/CoreBluetooth.h>
#import "THEPeerBluetooth.h"

// The maximum status length is 140 characters * 4 bytes (the maximum UTF-8 bytes per character).
const NSUInteger kMaxStatusDataLength = 140 * 4;
const NSUInteger kMaxPeerNameLength = 100;

static NSString *const PEER_ID_CHARACTERISTIC_UID = @"E669893C-F4C2-4604-800A-5252CED237F9";
static NSString *const PEER_NAME_CHARACTERISTIC_UID = @"2EFDAD55-5B85-4C78-9DE8-07884DC051FA";

// THEPeripheralDescriptorState enumeration.
typedef NS_ENUM(NSUInteger, THEPeripheralDescriptorState)
{
    THEPeripheralDescriptorStateDisconnected  = 1,
    THEPeripheralDescriptorStateConnecting    = 2,
    THEPeripheralDescriptorStateInitializing  = 3,
    THEPeripheralDescriptorStateConnected     = 4
};

// THEPeripheralDescriptor interface.
@interface THEPeripheralDescriptor : NSObject

// Properties.
@property (nonatomic) NSString * peerID;
@property (nonatomic) NSString * peerName;
@property (nonatomic) THEPeripheralDescriptorState state;

// Class initializer.
- (instancetype)initWithPeripheral:(CBPeripheral *)peripheral
                      initialState:(THEPeripheralDescriptorState)initialState
                 bluetoothDelegate:(id<THEPeerBluetoothDelegate>)delegate;

@end

// THEPeripheralDescriptor implementation.
@implementation THEPeripheralDescriptor
{
@private
    // The peripheral.
    CBPeripheral * _peripheral;
    __weak id<THEPeerBluetoothDelegate> _delegate;
}

// Class initializer.
- (instancetype)initWithPeripheral:(CBPeripheral *)peripheral
                      initialState:(THEPeripheralDescriptorState)initialState
                 bluetoothDelegate:(id<THEPeerBluetoothDelegate>)delegate
{
    // Initialize superclass.
    self = [super init];
    
    // Handle errors.
    if (!self)
    {
        return nil;
    }
    
    // Initialize.
    _peripheral = peripheral;
    _state = initialState;

    _delegate = delegate;

    // Done.
    return self;
}

@end

// THECharacteristicUpdateDescriptor interface.
@interface THECharacteristicUpdateDescriptor : NSObject

// Properties.
@property (nonatomic, readonly) NSData * value;
@property (nonatomic, readonly) CBMutableCharacteristic * characteristic;

// Class initializer.
- (instancetype)initWithValue:(NSData *)value
               characteristic:(CBMutableCharacteristic *)characteristic;

@end

// THECharacteristicUpdateDescriptor implementation.
@implementation THECharacteristicUpdateDescriptor

// Class initializer.
- (instancetype)initWithValue:(NSData *)value
               characteristic:(CBMutableCharacteristic *)characteristic
{
    // Initialize superclass.
    self = [super init];
    
    // Handle errors.
    if (!self)
    {
        return nil;
    }
    
    // Initialize.
    _value = value;
    _characteristic = characteristic;
    
    // Done.
    return self;
}

@end

// THEPeerBluetooth (CBPeripheralManagerDelegate) interface.
@interface THEPeerBluetooth (CBPeripheralManagerDelegate) <CBPeripheralManagerDelegate>
@end

// THEPeerBluetooth (CBCentralManagerDelegate) interface.
@interface THEPeerBluetooth (CBCentralManagerDelegate) <CBCentralManagerDelegate>
@end

// THEPeerBluetooth (CBPeripheralDelegate) interface.
@interface THEPeerBluetooth (CBPeripheralDelegate) <CBPeripheralDelegate>
@end

// THEPeerBluetooth (Internal) interface.
@interface THEPeerBluetooth (Internal)

// Starts advertising.
- (void)startAdvertising;

// Stops advertising.
- (void)stopAdvertising;

// Starts scanning.
- (void)startScanning;

// Stops scanning.
- (void)stopScanning;

@end

// Possible states of bluetooth stack 
typedef enum bluetoothStates {
  STARTING,
  STARTED,
  STOPPING,
  STOPPED 
} BluetoothState;


// THEPeerBluetooth implementation.
@implementation THEPeerBluetooth
{
@private
    // The peer identifier.
    NSString * _peerIdentifier;
    
    // The peer name.
    NSString * _peerName;
    
    // The canonical peer name.
    NSData * _canonicalPeerName;
    
    // The service type.
    CBUUID * _serviceType;
    
    // The peer ID type.
    CBUUID * _peerIDType;

    // The peer name type.
    CBUUID * _peerNameType;
    
    // The service.
    CBMutableService * _service;
    
    // The peer ID characteristic.
    CBMutableCharacteristic * _characteristicPeerID;

    // The peer name characteristic.
    CBMutableCharacteristic * _characteristicPeerName;
    
    // The advertising data.
    NSDictionary * _advertisingData;
    
    // The peripheral manager.
    CBPeripheralManager * _peripheralManager;
    
    // The central manager.
    CBCentralManager * _centralManager;
    
    // Current state of the bluetooth stack   
    BluetoothState _state;

    // Track outstanding callbacks to better manage STARTING->STOPPING transition
    BOOL _centralCallbackOutstanding;
    BOOL _peripheralCallbackOutstanding;
 
    // The perhipherals dictionary.
    NSMutableDictionary * _peripherals;
    
    // The pending characteristic updates array.
    NSMutableArray * _pendingCharacteristicUpdates;

    // The bluetooth delegate which will receive peer availability updates
    __weak id<THEPeerBluetoothDelegate> _delegate;
}

// References to instances that are stopping and awaiting a callback
// They can't be destroyed until the callbacks happen (and we've no way to cancel the callback)
static NSMutableSet * _stoppingInstances;

// Static initializer
+ (void)initialize
{
  _stoppingInstances = [[NSMutableSet alloc] init];
}

// Class initializer.
- (instancetype)initWithServiceType:(NSUUID *)serviceType
                     peerIdentifier:(NSString *)peerIdentifier
                           peerName:(NSString *)peerName
                  bluetoothDelegate:(id<THEPeerBluetoothDelegate>) delegate
{
    // Initialize superclass.
    self = [super init];
    
    // Handle errors.
    if (!self)
    {
        return nil;
    }
   
    _delegate = delegate;
 
    // If the peer name is too long, truncate it.
    if ([peerName length] > 100)
    {
        [peerName substringWithRange:NSMakeRange(0, 100)];
    }

    // Initialize.
    _serviceType = [CBUUID UUIDWithNSUUID:serviceType];
    _peerIdentifier = peerIdentifier;
    _peerName = peerName;
    _canonicalPeerName = [_peerName dataUsingEncoding:NSUTF8StringEncoding];
    
    // Initialize the peer identifier value.
    NSData * peerIdentifierValue = [_peerIdentifier dataUsingEncoding:NSUTF8StringEncoding];
    
    // Allocate and initialize the peer ID type.
    _peerIDType = [CBUUID UUIDWithString:PEER_ID_CHARACTERISTIC_UID];
    
    // Allocate and initialize the peer name type.
    _peerNameType = [CBUUID UUIDWithString:PEER_NAME_CHARACTERISTIC_UID];
    
    // Allocate and initialize the service.
    _service = [[CBMutableService alloc] initWithType:_serviceType
                                              primary:YES];
    
    // Allocate and initialize the peer ID characteristic.
    _characteristicPeerID = [[CBMutableCharacteristic alloc] 
                                    initWithType:_peerIDType
                                      properties:CBCharacteristicPropertyRead
                                           value:peerIdentifierValue
                                     permissions:CBAttributePermissionsReadable];

    // Allocate and initialize the peer name characteristic.
    _characteristicPeerName = [[CBMutableCharacteristic alloc] 
                                        initWithType:_peerNameType
                                          properties:CBCharacteristicPropertyRead
                                               value:_canonicalPeerName
                                         permissions:CBAttributePermissionsReadable];

    // Set the service characteristics.
    [_service setCharacteristics:@[_characteristicPeerID, _characteristicPeerName]];
    
    // Allocate and initialize the advertising data.
    _advertisingData = @{CBAdvertisementDataServiceUUIDsKey: @[_serviceType],
                            CBAdvertisementDataLocalNameKey: _peerName};
    
    // The background queue.
    dispatch_queue_t backgroundQueue = 
      dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_BACKGROUND, 0);
   
    // Allocate and initialize the peripheral manager.
    _peripheralManager = [[CBPeripheralManager alloc] 
                            initWithDelegate:self
                                       queue:backgroundQueue];
    
    // peripheralManager will shortly call us back with info on the 
    // BT state, we can't destroy this instance until it does
    _peripheralCallbackOutstanding = (_peripheralManager != nil);
    
    // Allocate and initialize the central manager.
    _centralManager = [[CBCentralManager alloc] initWithDelegate:self
                                                           queue:backgroundQueue];

    // centralManager will shortly call us back with info on the 
    // BT state, we can't destroy this instance until it does
    _centralCallbackOutstanding = (_centralManager != nil);
    
    // Allocate and initialize the peripherals dictionary. It contains a THEPeripheralDescriptor for
    // every peripheral we are either connecting or connected to.
    _peripherals = [[NSMutableDictionary alloc] init];
    
    // Allocate and initialize the pending updates array. It contains a 
    // THECharacteristicUpdateDescriptor for each characteristic update that is pending 
    // after a failed call to CBPeripheralManager
    // updateValue:forCharacteristic:onSubscribedCentrals.
    _pendingCharacteristicUpdates = [[NSMutableArray alloc] init];
    
    _state = STARTING;
 
    // Done.
    return self;
}

// Stops peer Bluetooth.
- (void)stop
{
  @synchronized(self)
  {
    assert(_state == STARTING || _state == STARTED);

    if (_state == STARTING)
    {
      // We have an outstanding callback, keep ourself alive until
      // that's cleared, don't clear delegates yet since that
      // could stop the callback happening
      [_stoppingInstances addObject:self];
    }

    _delegate = nil;
    _peripheralManager.delegate = nil;
    _centralManager.delegate = nil;

    _state = STOPPING;

    [self stopAdvertising];
    [self stopScanning];
  }
}

- (BOOL)tryReleaseSelf
{
  if (_state == STOPPING)
  {
    if (!_peripheralCallbackOutstanding && !_centralCallbackOutstanding)
    {
      assert([_stoppingInstances member:self]);

      _delegate = nil;
      _peripheralManager.delegate = nil;
      _centralManager.delegate = nil;

      [_stoppingInstances removeObject:self];
      _state = STOPPED;

      return YES;
    }
  }
  return NO;
}

@end

// THEPeerBluetooth (CBPeripheralManagerDelegate) implementation.
@implementation THEPeerBluetooth (CBPeripheralManagerDelegate)

// Invoked whenever the peripheral manager's state has been updated.
- (void)peripheralManagerDidUpdateState:(CBPeripheralManager *)peripheralManager
{
  @synchronized(self)
  {
    assert(_state == STARTING || _state == STOPPING);

    _peripheralCallbackOutstanding = NO;
    if ([self tryReleaseSelf])
    {
      // We're about to go away, nothing more to do
      return;
    }

    BOOL bluetoothEnabled = ([_peripheralManager state] == CBPeripheralManagerStatePoweredOn);
    [_delegate peerBluetooth:self didUpdateState:bluetoothEnabled];

    if (bluetoothEnabled)
    {
      // BT is on, we can advertise

      if (_state == STARTING)
      {
        [self startAdvertising];

        if (_centralCallbackOutstanding == NO)
        {
          // If we've had both callbacks we can safely say we've started
          _state = STARTED;
        }
      }
    }
    else
    {
      // BT is off, we should stop

      if (_state == STARTED)
      {
        [self stopAdvertising];
      }
    }
  }
}

// Invoked with the result of a startAdvertising call.
- (void)peripheralManagerDidStartAdvertising:(CBPeripheralManager *)peripheralManager
                                       error:(NSError *)error
{
}


// Invoked with the result of a addService call.
- (void)peripheralManager:(CBPeripheralManager *)peripheralManager
            didAddService:(CBService *)service
                    error:(NSError *)error
{
}

// Invoked after a failed call to update a characteristic.
- (void)peripheralManagerIsReadyToUpdateSubscribers:(CBPeripheralManager *)peripheralManager
{
  @synchronized(self)
  {
    // Process as many pending characteristic updates as we can.
    while ([_pendingCharacteristicUpdates count])
    {
      // Process the next pending characteristic update. 
      // If the tranmission queue is full, stop processing.
      THECharacteristicUpdateDescriptor * characteristicUpdateDescriptor = 
        _pendingCharacteristicUpdates[0];

      if (![_peripheralManager updateValue:[characteristicUpdateDescriptor value]
                         forCharacteristic:[characteristicUpdateDescriptor characteristic]
                      onSubscribedCentrals:nil])
      {
          break;
      }
      
      // Remove the pending characteristic update we processed.
      [_pendingCharacteristicUpdates removeObjectAtIndex:0];
    }
  }
}
@end

// THEPeerBluetooth (CBCentralManagerDelegate) implementation.
@implementation THEPeerBluetooth (CBCentralManagerDelegate)

// Invoked whenever the central manager's state has been updated.
- (void)centralManagerDidUpdateState:(CBCentralManager *)centralManager
{
  @synchronized(self)
  {
    assert(_state == STARTING || _state == STOPPING);

    // If the central manager is powered on, make sure we're scanning. If it's in any other state,
    // make sure we're not scanning.

    _centralCallbackOutstanding = NO;
    if ([self tryReleaseSelf])
    {
      // We're about to go away, nothing more to do
      return;
    }

    if ([_centralManager state] == CBCentralManagerStatePoweredOn)
    {
      if (_state == STARTING)
      {
        [self startScanning];

        if (_peripheralCallbackOutstanding == NO)
        {
          // If we've had both callbacks we can safely say we've started
          _state = STARTED;
        }
      }
    }
    else
    {
      if (_state == STARTED)
      {
        [self stopScanning];
      }
    }
  }
}

// Invoked when a peripheral is discovered.
- (void)centralManager:(CBCentralManager *)centralManager
 didDiscoverPeripheral:(CBPeripheral *)peripheral
     advertisementData:(NSDictionary *)advertisementData
                  RSSI:(NSNumber *)RSSI
{
  // Obtain the peripheral identifier string.
  NSString * peripheralIdentifierString = [[peripheral identifier] UUIDString];
    
  @synchronized(self)
  {
    // If we're not connected or connecting to this peripheral, connect to it.
    if (!_peripherals[peripheralIdentifierString])
    {
      // Add a THEPeripheralDescriptor to the peripherals dictionary.
      _peripherals[peripheralIdentifierString] = [[THEPeripheralDescriptor alloc] 
                                      initWithPeripheral:peripheral
                                            initialState:THEPeripheralDescriptorStateConnecting
                                       bluetoothDelegate:_delegate];

        // Connect to the peripheral.
      [_centralManager connectPeripheral:peripheral
                                 options:nil];
    }
  }
}

// Invoked when a peripheral is connected.
- (void)centralManager:(CBCentralManager *)centralManager
  didConnectPeripheral:(CBPeripheral *)peripheral
{
  // Get the peripheral identifier string.
  NSString * peripheralIdentifierString = [[peripheral identifier] UUIDString];
  
  @synchronized(self)
  {
    // Find the peripheral descriptor in the peripherals dictionary. It should be there.
    THEPeripheralDescriptor * peripheralDescriptor = _peripherals[peripheralIdentifierString];
    if (peripheralDescriptor)
    {
        // Update the peripheral descriptor state.
        [peripheralDescriptor setState:THEPeripheralDescriptorStateInitializing];
    }
    else
    {
        // Allocate a new peripheral descriptor and add it to the peripherals dictionary.
        peripheralDescriptor = [[THEPeripheralDescriptor alloc] 
                                       initWithPeripheral:peripheral
                                             initialState:THEPeripheralDescriptorStateInitializing
                                        bluetoothDelegate:_delegate];
        _peripherals[peripheralIdentifierString] = peripheralDescriptor;
    }
    
    // Set our delegate on the peripheral and discover its services.
    [peripheral discoverServices:@[_serviceType]];
  }
}

// Invoked when a peripheral connection fails.
- (void)centralManager:(CBCentralManager *)centralManager
didFailToConnectPeripheral:(CBPeripheral *)peripheral
                 error:(NSError *)error
{
  // Get the peripheral identifier string.
  NSString * peripheralIdentifierString = [[peripheral identifier] UUIDString];

  @synchronized(self)
  {  
    // Find the peripheral descriptor in the peripherals dictionary. It should be there.
    THEPeripheralDescriptor * peripheralDescriptor = _peripherals[peripheralIdentifierString];
    if (peripheralDescriptor)
    {
        // Immediately reconnect. This is long-lived meaning that we will connect to this peer 
        // whenever it is encountered again.
        [peripheralDescriptor setState:THEPeripheralDescriptorStateConnecting];
        [_centralManager connectPeripheral:peripheral
                                   options:nil];
    }
  }    
}

// Invoked when a peripheral is disconnected.
- (void)centralManager:(CBCentralManager *)centralManager
didDisconnectPeripheral:(CBPeripheral *)peripheral
                  error:(NSError *)error
{
  // Get the peripheral identifier string.
  NSString * peripheralIdentifierString = [[peripheral identifier] UUIDString];

  @synchronized(self)
  {
    // Find the peripheral descriptor in the peripherals dictionary. It should be there.
    THEPeripheralDescriptor * peripheralDescriptor = 
      [_peripherals objectForKey:peripheralIdentifierString];

    if (peripheralDescriptor)
    {
      // Notify the delegate.
      if ([peripheralDescriptor peerName])
      {
        [_delegate peerBluetooth:self 
            didDisconnectPeerIdentifier:[peripheralDescriptor peerID]];
      }
        
      // Immediately reconnect. This is long-lived. Central manager will connect to this peer 
      // whenever it is discovered again.
      [peripheralDescriptor setState:THEPeripheralDescriptorStateConnecting];
      [_centralManager connectPeripheral:peripheral
                                 options:nil];
    }
  }
}

@end

// THEPeerBluetooth (CBPeripheralDelegate) implementation.
@implementation THEPeerBluetooth (CBPeripheralDelegate)

// Invoked when services are discovered.
- (void)peripheral:(CBPeripheral *)peripheral
didDiscoverServices:(NSError *)error
{
  // Process the services.
  for (CBService * service in [peripheral services])
  {
    // If this is our service, discover its characteristics.
    if ([[service UUID] isEqual:_serviceType])
    {
        [peripheral discoverCharacteristics:@[_peerIDType,
                                              _peerNameType]
                                 forService:service];
    }
  }
}

// Invoked when service characteristics are discovered.
- (void)peripheral:(CBPeripheral *)peripheral
didDiscoverCharacteristicsForService:(CBService *)service
             error:(NSError *)error
{
  // Get the peripheral identifier string.
  NSString * peripheralIdentifierString = [[peripheral identifier] UUIDString];
    
  @synchronized(self)
  { 
    // Obtain the peripheral descriptor.
    THEPeripheralDescriptor * peripheralDescriptor = _peripherals[peripheralIdentifierString];
    if (peripheralDescriptor)
    {
      // If this is our service, process its discovered characteristics.
      if ([[service UUID] isEqual:_serviceType])
      {
        // Process each of the discovered characteristics.
        for (CBCharacteristic * characteristic in [service characteristics])
        {
          // Peer ID characteristic.
          if ([[characteristic UUID] isEqual:_peerIDType])
          {
            // Read it.
            [peripheral readValueForCharacteristic:characteristic];
          }
          // Peer name characteristic.
          else if ([[characteristic UUID] isEqual:_peerNameType])
          {
            // Read it.
            [peripheral readValueForCharacteristic:characteristic];
          }
        }
      }
    }
  }
}

// Invoked when the value of a characteristic is updated.
- (void)peripheral:(CBPeripheral *)peripheral
didUpdateValueForCharacteristic:(CBCharacteristic *)characteristic
             error:(NSError *)error
{
  // Get the peripheral identifier string.
  NSString * peripheralIdentifierString = [[peripheral identifier] UUIDString];

  @synchronized(self)
  {
    // Obtain the peripheral descriptor.
    THEPeripheralDescriptor * peripheralDescriptor = _peripherals[peripheralIdentifierString];
    if (peripheralDescriptor)
    {
      // Peer ID characteristic.
      if ([[characteristic UUID] isEqual:_peerIDType])
      {
        // When the peer ID is updated, set the peer ID in the peripheral descriptor.
        [peripheralDescriptor setPeerID:[
            [NSString alloc] initWithData:[characteristic value] 
                                 encoding:NSUTF8StringEncoding]];
      }
      // Peer name characteristic.
      else if ([[characteristic UUID] isEqual:_peerNameType])
      {
        // When the peer name is updated, set the peer name in the peripheral descriptor.
        [peripheralDescriptor setPeerName:[[NSString alloc] 
                             initWithData:[characteristic value]
                                 encoding:NSUTF8StringEncoding]];
      }
        
      // Detect when the peer is fully initialized and move it to the connected state.
      if ([peripheralDescriptor state] == THEPeripheralDescriptorStateInitializing && 
          [peripheralDescriptor peerID] && [peripheralDescriptor peerName])
      {
        // Move the peer to the connected state.
        [peripheralDescriptor setState:THEPeripheralDescriptorStateConnected];
            
        // Notify the delegate that the peer is connected.
        [_delegate peerBluetooth:self
              didConnectPeerIdentifier:[peripheralDescriptor peerID]
                              peerName:[peripheralDescriptor peerName]];
      }
    }
  }
}

@end

// THEPeerBluetooth (Internal) implementation.
@implementation THEPeerBluetooth (Internal)

// Starts advertising.
- (void)startAdvertising
{
  if ([_peripheralManager state] == CBPeripheralManagerStatePoweredOn && 
      ![_peripheralManager isAdvertising])
  {
    [_peripheralManager addService:_service];
    [_peripheralManager startAdvertising:_advertisingData];
  }
}

// Stops advertising.
- (void)stopAdvertising
{
  if ([_peripheralManager isAdvertising])
  {
    [_peripheralManager removeAllServices];
    [_peripheralManager stopAdvertising];
  }
}

// Starts scanning.
- (void)startScanning
{
  if ([_centralManager state] == CBCentralManagerStatePoweredOn)
  {
    [_centralManager 
        scanForPeripheralsWithServices:@[_serviceType]
                               options:@{CBCentralManagerScanOptionAllowDuplicatesKey: @(NO)}];
  }
}

// Stops scanning.
- (void)stopScanning
{
  [_centralManager stopScan];
}

@end
