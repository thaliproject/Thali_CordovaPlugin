//
//  The MIT License (MIT)
//
//  Copyright (c) 2015 Brian Lambert.
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
//  THEPeerBluetooth.m
//

#import <pthread.h>
#import <CoreBluetooth/CoreBluetooth.h>
#import "THEPeerBluetooth.h"

// The maximum status length is 140 characters * 4 bytes (the maximum UTF-8 bytes per character).
const NSUInteger kMaxStatusDataLength = 140 * 4;
const NSUInteger kMaxPeerNameLength = 100;

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
@property (nonatomic) NSUUID * peerID;
@property (nonatomic) NSString * peerName;
@property (nonatomic) THEPeripheralDescriptorState state;

// Class initializer.
- (instancetype)initWithPeripheral:(CBPeripheral *)peripheral
                      initialState:(THEPeripheralDescriptorState)initialState;

@end

// THEPeripheralDescriptor implementation.
@implementation THEPeripheralDescriptor
{
@private
    // The peripheral.
    CBPeripheral * _peripheral;
}

// Class initializer.
- (instancetype)initWithPeripheral:(CBPeripheral *)peripheral
                      initialState:(THEPeripheralDescriptorState)initialState
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

// THEPeerBluetooth implementation.
@implementation THEPeerBluetooth
{
@private
    // The peer identifier.
    NSUUID * _peerIdentifier;
    
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
    
    // Mutex used to synchronize accesss to the things below.
    pthread_mutex_t _mutex;
    
    // The enabled flag.
    BOOL _enabled;
    
    // The scanning flag.
    BOOL _scanning;
    
    // The perhipherals dictionary.
    NSMutableDictionary * _peripherals;
    
    // The pending characteristic updates array.
    NSMutableArray * _pendingCharacteristicUpdates;
}

// Class initializer.
- (instancetype)initWithServiceType:(NSUUID *)serviceType
                     peerIdentifier:(NSUUID *)peerIdentifier
                           peerName:(NSString *)peerName
{
    // Initialize superclass.
    self = [super init];
    
    // Handle errors.
    if (!self)
    {
        return nil;
    }
    
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
    UInt8 uuid[16];
    [_peerIdentifier getUUIDBytes:uuid];
    NSData * peerIdentifierValue = [NSData dataWithBytes:uuid
                                                  length:sizeof(uuid)];
    
    // Allocate and initialize the peer ID type.
    _peerIDType = [CBUUID UUIDWithString:@"E669893C-F4C2-4604-800A-5252CED237F9"];
    
    // Allocate and initialize the peer name type.
    _peerNameType = [CBUUID UUIDWithString:@"2EFDAD55-5B85-4C78-9DE8-07884DC051FA"];
    
    // Allocate and initialize the service.
    _service = [[CBMutableService alloc] initWithType:_serviceType
                                              primary:YES];
    
    // Allocate and initialize the peer ID characteristic.
    _characteristicPeerID = [[CBMutableCharacteristic alloc] initWithType:_peerIDType
                                                               properties:CBCharacteristicPropertyRead
                                                                    value:peerIdentifierValue
                                                              permissions:CBAttributePermissionsReadable];

    // Allocate and initialize the peer name characteristic.
    _characteristicPeerName = [[CBMutableCharacteristic alloc] initWithType:_peerNameType
                                                                 properties:CBCharacteristicPropertyRead
                                                                      value:_canonicalPeerName
                                                                permissions:CBAttributePermissionsReadable];

    // Set the service characteristics.
    [_service setCharacteristics:@[_characteristicPeerID,
                                   _characteristicPeerName]];
    
    // Allocate and initialize the advertising data.
    _advertisingData = @{CBAdvertisementDataServiceUUIDsKey:    @[_serviceType],
                         CBAdvertisementDataLocalNameKey:       _peerName};
    
    // The background queue.
    dispatch_queue_t backgroundQueue = dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_BACKGROUND, 0);
    
    // Allocate and initialize the peripheral manager.
    _peripheralManager = [[CBPeripheralManager alloc] initWithDelegate:(id<CBPeripheralManagerDelegate>)self
                                                                 queue:backgroundQueue];
    
    // Allocate and initialize the central manager.
    _centralManager = [[CBCentralManager alloc] initWithDelegate:(id<CBCentralManagerDelegate>)self
                                                           queue:backgroundQueue];
    
    // Initialize
    pthread_mutex_init(&_mutex, NULL);
   
    // Allocate and initialize the peripherals dictionary. It contains a THEPeripheralDescriptor for
    // every peripheral we are either connecting or connected to.
    _peripherals = [[NSMutableDictionary alloc] init];
    
    // Allocate and initialize the pending updates array. It contains a THECharacteristicUpdateDescriptor
    // for each characteristic update that is pending after a failed call to CBPeripheralManager
    // updateValue:forCharacteristic:onSubscribedCentrals.
    _pendingCharacteristicUpdates = [[NSMutableArray alloc] init];
    
    // Done.
    return self;
}

// Starts peer Bluetooth.
- (void)start
{
    // Lock.
    pthread_mutex_lock(&_mutex);
    
    // Start, if we should.
    if (!_enabled)
    {
        _enabled = YES;
        [self startAdvertising];
        [self startScanning];
    }

    // Unlock.
    pthread_mutex_unlock(&_mutex);
}

// Stops peer Bluetooth.
- (void)stop
{
    // Lock.
    pthread_mutex_lock(&_mutex);

    // Stop, if we should.
    if (_enabled)
    {
        _enabled = NO;
        [self stopAdvertising];
        [self stopScanning];
    }

    // Unlock.
    pthread_mutex_unlock(&_mutex);
}

@end

// THEPeerBluetooth (CBPeripheralManagerDelegate) implementation.
@implementation THEPeerBluetooth (CBPeripheralManagerDelegate)

// Invoked whenever the peripheral manager's state has been updated.
- (void)peripheralManagerDidUpdateState:(CBPeripheralManager *)peripheralManager
{
    // Lock.
    pthread_mutex_lock(&_mutex);

    // Process the state update.
    if ([_peripheralManager state] == CBPeripheralManagerStatePoweredOn)
    {
        [self startAdvertising];
    }
    else
    {
        [self stopAdvertising];
    }

    // Unlock.
    pthread_mutex_unlock(&_mutex);
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
    // Lock.
    pthread_mutex_lock(&_mutex);

    // Process as many pending characteristic updates as we can.
    while ([_pendingCharacteristicUpdates count])
    {
        // Process the next pending characteristic update. If the trasnmission queue is full, stop processing.
        THECharacteristicUpdateDescriptor * characteristicUpdateDescriptor = _pendingCharacteristicUpdates[0];
        if (![_peripheralManager updateValue:[characteristicUpdateDescriptor value]
                           forCharacteristic:[characteristicUpdateDescriptor characteristic]
                        onSubscribedCentrals:nil])
        {
            break;
        }
        
        // Remove the pending characteristic update we processed.
        [_pendingCharacteristicUpdates removeObjectAtIndex:0];
    }

    // Unlock.
    pthread_mutex_unlock(&_mutex);
}

@end

// THEPeerBluetooth (CBCentralManagerDelegate) implementation.
@implementation THEPeerBluetooth (CBCentralManagerDelegate)

// Invoked whenever the central manager's state has been updated.
- (void)centralManagerDidUpdateState:(CBCentralManager *)centralManager
{
    // Lock.
    pthread_mutex_lock(&_mutex);

    // If the central manager is powered on, make sure we're scanning. If it's in any other state,
    // make sure we're not scanning.
    if ([_centralManager state] == CBCentralManagerStatePoweredOn)
    {
        [self startScanning];
    }
    else
    {
        [self stopScanning];
    }

    // Unlock.
    pthread_mutex_unlock(&_mutex);
}

// Invoked when a peripheral is discovered.
- (void)centralManager:(CBCentralManager *)centralManager
 didDiscoverPeripheral:(CBPeripheral *)peripheral
     advertisementData:(NSDictionary *)advertisementData
                  RSSI:(NSNumber *)RSSI
{
    // Obtain the peripheral identifier string.
    NSString * peripheralIdentifierString = [[peripheral identifier] UUIDString];
    
    // Lock.
    pthread_mutex_lock(&_mutex);

    // If we're not connected or connecting to this peripheral, connect to it.
    if (!_peripherals[peripheralIdentifierString])
    {
        // Add a THEPeripheralDescriptor to the peripherals dictionary.
        _peripherals[peripheralIdentifierString] = [[THEPeripheralDescriptor alloc] initWithPeripheral:peripheral
                                                                              initialState:THEPeripheralDescriptorStateConnecting];

        // Connect to the peripheral.
        [_centralManager connectPeripheral:peripheral
                                   options:nil];
    }

    // Unlock.
    pthread_mutex_unlock(&_mutex);
}

// Invoked when a peripheral is connected.
- (void)centralManager:(CBCentralManager *)centralManager
  didConnectPeripheral:(CBPeripheral *)peripheral
{
    // Get the peripheral identifier string.
    NSString * peripheralIdentifierString = [[peripheral identifier] UUIDString];
    
    // Lock.
    pthread_mutex_lock(&_mutex);

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
        peripheralDescriptor = [[THEPeripheralDescriptor alloc] initWithPeripheral:peripheral
                                                          initialState:THEPeripheralDescriptorStateInitializing];
        _peripherals[peripheralIdentifierString] = peripheralDescriptor;
    }
    
    // Set our delegate on the peripheral and discover its services.
    [peripheral setDelegate:(id<CBPeripheralDelegate>)self];
    [peripheral discoverServices:@[_serviceType]];
    
    // Unlock.
    pthread_mutex_unlock(&_mutex);
}

// Invoked when a peripheral connection fails.
- (void)centralManager:(CBCentralManager *)centralManager
didFailToConnectPeripheral:(CBPeripheral *)peripheral
                 error:(NSError *)error
{
    // Get the peripheral identifier string.
    NSString * peripheralIdentifierString = [[peripheral identifier] UUIDString];
    
    // Lock.
    pthread_mutex_lock(&_mutex);
    
    // Find the peripheral descriptor in the peripherals dictionary. It should be there.
    THEPeripheralDescriptor * peripheralDescriptor = _peripherals[peripheralIdentifierString];
    if (peripheralDescriptor)
    {
        // Immediately reconnect. This is long-lived meaning that we will connect to this peer whenever it is
        // encountered again.
        [peripheralDescriptor setState:THEPeripheralDescriptorStateConnecting];
        [_centralManager connectPeripheral:peripheral
                                   options:nil];
    }
    
    // Unlock.
    pthread_mutex_unlock(&_mutex);
}

// Invoked when a peripheral is disconnected.
- (void)centralManager:(CBCentralManager *)centralManager
didDisconnectPeripheral:(CBPeripheral *)peripheral
                 error:(NSError *)error
{
    // Get the peripheral identifier string.
    NSString * peripheralIdentifierString = [[peripheral identifier] UUIDString];

    // Lock.
    pthread_mutex_lock(&_mutex);

    // Find the peripheral descriptor in the peripherals dictionary. It should be there.
    THEPeripheralDescriptor * peripheralDescriptor = [_peripherals objectForKey:peripheralIdentifierString];
    if (peripheralDescriptor)
    {
        // Notify the delegate.
        if ([peripheralDescriptor peerName])
        {
            if ([[self delegate] respondsToSelector:@selector(peerBluetooth:didDisconnectPeerIdentifier:)])
            {
                [[self delegate] peerBluetooth:self
                   didDisconnectPeerIdentifier:[peripheralDescriptor peerID]];
            }
        }
        
        // Immediately reconnect. This is long-lived. Central manager will connect to this peer whenever it is
        // discovered again.
        [peripheralDescriptor setState:THEPeripheralDescriptorStateConnecting];
        [_centralManager connectPeripheral:peripheral
                                   options:nil];
    }

    // Unlock.
    pthread_mutex_unlock(&_mutex);
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
    
    // Lock.
    pthread_mutex_lock(&_mutex);
    
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
    
    // Unlock.
    pthread_mutex_unlock(&_mutex);
}

// Invoked when the value of a characteristic is updated.
- (void)peripheral:(CBPeripheral *)peripheral
didUpdateValueForCharacteristic:(CBCharacteristic *)characteristic
             error:(NSError *)error
{
    // Get the peripheral identifier string.
    NSString * peripheralIdentifierString = [[peripheral identifier] UUIDString];

    // Lock.
    pthread_mutex_lock(&_mutex);

    // Obtain the peripheral descriptor.
    THEPeripheralDescriptor * peripheralDescriptor = _peripherals[peripheralIdentifierString];
    if (peripheralDescriptor)
    {
        // Peer ID characteristic.
        if ([[characteristic UUID] isEqual:_peerIDType])
        {
            // When the peer ID is updated, set the peer ID in the peripheral descriptor.
            [peripheralDescriptor setPeerID:[[NSUUID alloc] initWithUUIDBytes:[[characteristic value] bytes]]];
        }
        // Peer name characteristic.
        else if ([[characteristic UUID] isEqual:_peerNameType])
        {
            // When the peer name is updated, set the peer name in the peripheral descriptor.
            [peripheralDescriptor setPeerName:[[NSString alloc] initWithData:[characteristic value]
                                                                    encoding:NSUTF8StringEncoding]];
        }
        
        // Detect when the peer is fully initialized and move it to the connected state.
        if ([peripheralDescriptor state] == THEPeripheralDescriptorStateInitializing && [peripheralDescriptor peerID] && [peripheralDescriptor peerName])
        {
            // Move the peer to the connected state.
            [peripheralDescriptor setState:THEPeripheralDescriptorStateConnected];
            
            // Notify the delegate that the peer is connected.
            if ([[self delegate] respondsToSelector:@selector(peerBluetooth:didConnectPeerIdentifier:peerName:)])
            {
                [[self delegate] peerBluetooth:self
                      didConnectPeerIdentifier:[peripheralDescriptor peerID]
                                      peerName:[peripheralDescriptor peerName]];
            }
        }
    }

    // Unlock.
    pthread_mutex_unlock(&_mutex);
}

@end

// THEPeerBluetooth (Internal) implementation.
@implementation THEPeerBluetooth (Internal)

// Starts advertising.
- (void)startAdvertising
{
    if ([_peripheralManager state] == CBPeripheralManagerStatePoweredOn && _enabled && ![_peripheralManager isAdvertising])
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
    if ([_centralManager state] == CBCentralManagerStatePoweredOn && _enabled && !_scanning)
    {
        _scanning = YES;
        [_centralManager scanForPeripheralsWithServices:@[_serviceType]
                                                options:@{CBCentralManagerScanOptionAllowDuplicatesKey: @(NO)}];
    }
}

// Stops scanning.
- (void)stopScanning
{
    if (_scanning)
    {
        _scanning = NO;
        [_centralManager stopScan];
    }
}

@end
