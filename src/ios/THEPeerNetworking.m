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
//  THEPeerNetworking.m
//

#import <pthread.h>
#include "jx.h"
#import "JXcore.h"
#import "THEThreading.h"
#import <MultipeerConnectivity/MultipeerConnectivity.h>
#import "THEPeerNetworking.h"
#import "THEPeerDescriptor.h"
#import "THEMultipeerClient.h"
#import "THEMultipeerServer.h"

// Static declarations.
static NSString * const PEER_ID_KEY             = @"ThaliPeerID";

// THEPeerNetworking implementation.
@implementation THEPeerNetworking
{
@private
    NSString * _serviceType;
    NSString * _peerIdentifier;
    NSString * _peerName;

    MCPeerID * _peerID;
   
    // Mutex used to synchronize accesss to the things below.
    pthread_mutex_t _mutex;

    MultipeerClient *_client;
    MultipeerServer *_server;
}

- (instancetype)initWithServiceType:(NSString *)serviceType
                     peerIdentifier:(NSString *)peerIdentifier
                           peerName:(NSString *)peerName
{
    self = [super init];
    
    if (!self)
    {
        return nil;
    }
    
    _serviceType = serviceType;
    _peerIdentifier = peerIdentifier;
    _peerName = peerName;

    pthread_mutex_init(&_mutex, NULL);
    
    return self;
}

// Starts peer networking.
- (void)start
{
    // Obtain user defaults and see if we have a serialized MCPeerID. If we do, deserialize it. If not, make one
    // and serialize it for later use. If we don't serialize and reuse the MCPeerID, we'll see duplicates
    // of this peer in sessions.
    NSUserDefaults * userDefaults = [NSUserDefaults standardUserDefaults];
    NSData * data = [userDefaults dataForKey:PEER_ID_KEY];
    if ([data length])
    {
        // Deserialize the MCPeerID.
        _peerID = [NSKeyedUnarchiver unarchiveObjectWithData:data];
    }
    else
    {
        // Allocate and initialize a new MCPeerID.
        _peerID = [[MCPeerID alloc] 
            initWithDisplayName:[NSString stringWithFormat:@"%@", [[UIDevice currentDevice] name]]
        ];
        
        // Serialize and save the MCPeerID in user defaults.
        data = [NSKeyedArchiver archivedDataWithRootObject:_peerID];
        [userDefaults setValue:data forKey:PEER_ID_KEY];
        [userDefaults synchronize];
    }
    
  
    _server = [[MultipeerServer alloc] initWithPeerId: _peerID 
        withPeerIdentifier: _peerIdentifier withPeerName: _peerName withServiceType: _serviceType
    ];

    _client = [[MultipeerClient alloc] 
        initWithPeerId: _peerID withServiceType: _serviceType withPeerNetworkingDelegate: _delegate
    ];

    [_server start];
    [_client start];

    NSLog(@"THEPeerNetworking initialized peer %@", [_peerID displayName]);
}

- (void)stop
{
    NSLog(@"THEPeerNetworking stopping peer");

    [_client stop];
    _client = nil;

    [_server stop];
    _server = nil;
    
    _peerID = nil;
}

- (BOOL)connectToPeerServerWithPeerIdentifier:(NSString *)peerIdentifier
{
    return [_client connectToPeerWithPeerIdentifier:peerIdentifier];
}

// Connects from the peer server with the specified peer identifier.
- (BOOL)disconnectFromPeerServerWithPeerIdentifier:(NSString *)peerIdentifier
{
    return [_client disconnectFromPeerWithPeerIdentifier:peerIdentifier];
}

@end
