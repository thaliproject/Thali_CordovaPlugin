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
//  THEPeerNetworking.m
//

#import <pthread.h>
#include "jx.h"
#import "JXcore.h"
#import <TSNThreading.h>
#import <MultipeerConnectivity/MultipeerConnectivity.h>
#import "THEPeerNetworking.h"

// Static declarations.
static NSString * const PEER_ID_KEY             = @"ThaliPeerID";
static NSString * const PEER_IDENTIFIER         = @"PeerIdentifier";
static NSString * const PEER_NAME               = @"PeerName";
static NSString * const CLIENT_OUTPUT_STREAM    = @"ClientOutputStream";
static NSString * const SERVER_OUTPUT_STREAM    = @"ServerOutputStream";

// THEPeerDescriptorState enumeration.
typedef NS_ENUM(NSUInteger, THEPeerDescriptorState)
{
    THEPeerDescriptorStateNotConnected  = 0,
    THEPeerDescriptorStateConnecting    = 1,
    THEPeerDescriptorStateConnected     = 2
};

// THEPeerDescriptor interface.
@interface THEPeerDescriptor : NSObject

// Properties.
@property (nonatomic) MCPeerID * peerID;
@property (nonatomic) NSUUID * peerIdentifier;
@property (nonatomic) NSString * peerName;
@property (nonatomic) BOOL found;
@property (nonatomic) THEPeerDescriptorState serverState;
@property (nonatomic) THEPeerDescriptorState clientState;

@property (nonatomic) NSOutputStream * clientOutputStream;
@property (nonatomic) NSInputStream * clientInputStream;

@property (nonatomic) NSInputStream * serverInputStream;
@property (nonatomic) NSOutputStream * serverOutputStream;

// Class initializer.
- (instancetype)initWithPeerID:(MCPeerID *)peerID
                peerIdentifier:(NSUUID *)peerIdentifier
                      peerName:(NSString *)peerName;

@end

// THEPeerDescriptor implementation.
@implementation THEPeerDescriptor
{
@private
}

// Class initializer.
- (instancetype)initWithPeerID:(MCPeerID *)peerID
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
    
    // Initialize.
    _peerID = peerID;
    _peerIdentifier = peerIdentifier;
    _peerName = peerName;
    
    // Done.
    return self;
}

@end

// THEPeerNetworking (MCNearbyServiceAdvertiserDelegate) interface.
@interface THEPeerNetworking (MCNearbyServiceAdvertiserDelegate) <MCNearbyServiceAdvertiserDelegate>
@end

// THEPeerNetworking (MCNearbyServiceBrowserDelegate) interface.
@interface THEPeerNetworking (MCNearbyServiceBrowserDelegate) <MCNearbyServiceBrowserDelegate>
@end


// THEPeerNetworking (MCSessionDelegate) interface.
@interface THEPeerNetworking (MCSessionDelegate) <MCSessionDelegate>
@end

// THEPeerNetworking (Internal) interface.
@interface THEPeerNetworking (Internal)
@end

// THEPeerNetworking implementation.
@implementation THEPeerNetworking
{
@private
    // The service type.
    NSString * _serviceType;
    
    // The peer identifier.
    NSUUID * _peerIdentifier;
    
    // The peer name.
    NSString * _peerName;

    // The peer ID.
    MCPeerID * _peerID;
    
    // The server session.
    MCSession * _serverSession;
    
    // The client session.
    MCSession * _clientSession;

    // The nearby service advertiser.
    MCNearbyServiceAdvertiser * _nearbyServiceAdvertiser;
    
    // The nearby service browser.
    MCNearbyServiceBrowser * _nearbyServiceBrowser;
    
    // Mutex used to synchronize accesss to the things below.
    pthread_mutex_t _mutex;

    // The peers dictionary.
    NSMutableDictionary * _peers;
}

// Class initializer.
- (instancetype)initWithServiceType:(NSString *)serviceType
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
    
    // Initialize.
    _serviceType = serviceType;
    _peerIdentifier = peerIdentifier;
    _peerName = peerName;
    
    // Initialize
    pthread_mutex_init(&_mutex, NULL);
    
    // Allocate and initialize the peers dictionary. It contains a THEPeerDescriptor for
    // every peer we are aware of.
    _peers = [[NSMutableDictionary alloc] init];

    // Done.
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
        _peerID = [[MCPeerID alloc] initWithDisplayName:[NSString stringWithFormat:@"%@", [[UIDevice currentDevice] name]]];
        
        // Serialize and save the MCPeerID in user defaults.
        data = [NSKeyedArchiver archivedDataWithRootObject:_peerID];
        [userDefaults setValue:data
                        forKey:PEER_ID_KEY];
        [userDefaults synchronize];
    }
    
    // Allocate and initialize the server session.
    _serverSession = [[MCSession alloc] initWithPeer:_peerID
                              securityIdentity:nil
                          encryptionPreference:MCEncryptionRequired];
    [_serverSession setDelegate:(id<MCSessionDelegate>)self];
    
    // Allocate and initialize the client session.
    _clientSession = [[MCSession alloc] initWithPeer:_peerID
                                    securityIdentity:nil
                                encryptionPreference:MCEncryptionRequired];
    [_clientSession setDelegate:(id<MCSessionDelegate>)self];

    // Allocate and initialize the nearby service advertizer.
    _nearbyServiceAdvertiser = [[MCNearbyServiceAdvertiser alloc] initWithPeer:_peerID
                                                                 discoveryInfo:@{PEER_IDENTIFIER:   [_peerIdentifier UUIDString],
                                                                                 PEER_NAME:         _peerName}
                                                                   serviceType:_serviceType];
    [_nearbyServiceAdvertiser setDelegate:(id<MCNearbyServiceAdvertiserDelegate>)self];
    
    // Allocate and initialize the nearby service browser.
    _nearbyServiceBrowser = [[MCNearbyServiceBrowser alloc] initWithPeer:_peerID
                                                             serviceType:_serviceType];
    [_nearbyServiceBrowser setDelegate:(id<MCNearbyServiceBrowserDelegate>)self];
    
    // Start advertising this peer and browsing for peers.
    [_nearbyServiceAdvertiser startAdvertisingPeer];
    [_nearbyServiceBrowser startBrowsingForPeers];
    
    // Log.
    NSLog(@"THEPeerNetworking initialized peer %@", [_peerID displayName]);
}

// Stops peer networking.
- (void)stop
{
    // Stop advertising this peer and browsing for peers.
    [_nearbyServiceAdvertiser stopAdvertisingPeer];
    [_nearbyServiceBrowser stopBrowsingForPeers];
    
    // Disconnect from the sessions.
    [_serverSession disconnect];
    [_clientSession disconnect];
    
    // Clean up.
    _nearbyServiceAdvertiser = nil;
    _nearbyServiceBrowser = nil;
    _serverSession = nil;
    _clientSession = nil;
    _peerID = nil;
}

// Connects to the peer server with the specified peer identifier.
- (BOOL)connectToPeerServerWithPeerIdentifier:(NSUUID *)peerIdentifier
{
    // Lock.
    pthread_mutex_lock(&_mutex);

    // See if we have a peer descriptor matching the peer identifier.
    NSArray * peers = [_peers allValues];
    THEPeerDescriptor * peerDescriptor = nil;
    for (int i = 0; !peerDescriptor && i < [peers count]; i++)
    {
        THEPeerDescriptor * peerDescriptorToCheck = (THEPeerDescriptor *)peers[i];
        if ([peerIdentifier isEqual:[peerDescriptorToCheck peerIdentifier]])
        {
            peerDescriptor = peerDescriptorToCheck;
        }
    }
    
    // If we found a peer descriptor matching the peer identifier, invite the peer to our client session.
    // Semantically, we're inviting the peer into to our client session, so we can be a client of the peer's
    // server.
    if (peerDescriptor && [peerDescriptor clientState] == THEPeerDescriptorStateNotConnected)
    {
        [_nearbyServiceBrowser invitePeer:[peerDescriptor peerID]
                                toSession:_clientSession
                              withContext:nil
                                  timeout:30];
    }
    
    // Unlock.
    pthread_mutex_unlock(&_mutex);
    
    // Done.    
    return peerDescriptor != nil;
}

// Connects from the peer server with the specified peer identifier.
- (BOOL)disconnectFromPeerServerWithPeerIdentifier:(NSUUID *)peerIdentifier
{
    // Lock.
    pthread_mutex_lock(&_mutex);
    
    // See if we have a peer descriptor matching the peer identifier.
    NSArray * peers = [_peers allValues];
    THEPeerDescriptor * peerDescriptor = nil;
    for (int i = 0; !peerDescriptor && i < [peers count]; i++)
    {
        THEPeerDescriptor * peerDescriptorToCheck = (THEPeerDescriptor *)peers[i];
        if ([peerIdentifier isEqual:[peerDescriptorToCheck peerIdentifier]])
        {
            peerDescriptor = peerDescriptorToCheck;
        }
    }
    
    // If we found a peer descriptor matching the peer identifier, cancel the peer connection.
    if (peerDescriptor)
    {
        // Cancel the connection to the peer.
        [_clientSession cancelConnectPeer:[peerDescriptor peerID]];
    }
    
    // Unlock.
    pthread_mutex_unlock(&_mutex);
    
    // Done.
    return peerDescriptor != nil;
}

@end

// THEPeerNetworking (MCNearbyServiceAdvertiserDelegate) implementation.
@implementation THEPeerNetworking (MCNearbyServiceAdvertiserDelegate)

// Notifies the delegate that an invitation to join a session was received from a nearby peer.
- (void)advertiser:(MCNearbyServiceAdvertiser *)advertiser
didReceiveInvitationFromPeer:(MCPeerID *)peerID
       withContext:(NSData *)context
 invitationHandler:(void (^)(BOOL accept, MCSession * session))invitationHandler
{
    // Accept the invitation in our server session.
    invitationHandler(YES, _serverSession);
}

// Notifies the delegate that advertisement failed.
- (void)advertiser:(MCNearbyServiceAdvertiser *)advertiser
didNotStartAdvertisingPeer:(NSError *)error
{
    // TODO, error handing.
}

@end

// THEPeerNetworking (MCNearbyServiceBrowserDelegate) implementation.
@implementation THEPeerNetworking (MCNearbyServiceBrowserDelegate)

// Notifies the delegate that a peer was found.
- (void)browser:(MCNearbyServiceBrowser *)browser
      foundPeer:(MCPeerID *)peerID
withDiscoveryInfo:(NSDictionary *)info
{
    // Lock.
    pthread_mutex_lock(&_mutex);
    
    // Find the peer descriptor.
    THEPeerDescriptor * peerDescriptor = (THEPeerDescriptor *)_peers[peerID];

    // Process the event. If this is the first time we've discovered this peer, add it.
    if (!peerDescriptor)
    {
        peerDescriptor = [[THEPeerDescriptor alloc]initWithPeerID:peerID
                                                   peerIdentifier:[[NSUUID alloc] initWithUUIDString:info[PEER_IDENTIFIER]]
                                                         peerName:info[PEER_NAME]];
        [peerDescriptor setFound:YES];
        _peers[peerID] = peerDescriptor;
    }

    // Unlock.
    pthread_mutex_unlock(&_mutex);
    
    // Notify the delegate.
    if ([[self delegate] respondsToSelector:@selector(peerNetworking:didFindPeerIdentifier:peerName:)])
    {
        [[self delegate] peerNetworking:self
                  didFindPeerIdentifier:[peerDescriptor peerIdentifier]
                               peerName:[peerDescriptor peerName]];
    }
}

// Notifies the delegate that a peer was lost.
- (void)browser:(MCNearbyServiceBrowser *)browser
       lostPeer:(MCPeerID *)peerID
{
    // Lock.
    pthread_mutex_lock(&_mutex);
    
    // Find the peer descriptor.
    THEPeerDescriptor * peerDescriptor = (THEPeerDescriptor *)_peers[peerID];

    // If we have seen this peer, process the event.
    if (peerDescriptor)
    {
        [peerDescriptor setFound:NO];
    }
    
    // Unlock.
    pthread_mutex_unlock(&_mutex);
    
    // Notify the delegate.
    if (peerDescriptor)
    {
        if ([[self delegate] respondsToSelector:@selector(peerNetworking:didLosePeerIdentifier:)])
        {
            [[self delegate] peerNetworking:self
                      didLosePeerIdentifier:[peerDescriptor peerIdentifier]];
        }
    }
}

// Notifies the delegate that the browser failed to start browsing for peers.
- (void)browser:(MCNearbyServiceBrowser *)browser
didNotStartBrowsingForPeers:(NSError *)error
{
}

@end

// THEPeerNetworking (MCSessionDelegate) implementation.
@implementation THEPeerNetworking (MCSessionDelegate)

// Notifies the delegate that the local peer receieved data from a nearby peer.
- (void)session:(MCSession *)session
 didReceiveData:(NSData *)data
       fromPeer:(MCPeerID *)peerID
{
}

// Notifies the delegate that the local peer started receiving a resource from a nearby peer.
- (void)session:(MCSession *)session
didStartReceivingResourceWithName:(NSString *)resourceName
       fromPeer:(MCPeerID *)peerID
   withProgress:(NSProgress *)progress
{
}

// Notifies the delegate that the local peer finished receiving a resource from a nearby peer.
- (void)session:(MCSession *)session
didFinishReceivingResourceWithName:(NSString *)resourceName
       fromPeer:(MCPeerID *)peerID
          atURL:(NSURL *)localURL
      withError:(NSError *)error
{
}

// Notifies the delegate that the local peer received a stream from a nearby peer.
- (void)session:(MCSession *)session
didReceiveStream:(NSInputStream *)inputStream
       withName:(NSString *)streamName
       fromPeer:(MCPeerID *)peerID
{
    // Lock.
    pthread_mutex_lock(&_mutex);
    
    // Find the peer descriptor.
    THEPeerDescriptor * peerDescriptor = (THEPeerDescriptor *)_peers[peerID];
    
    // If we found the peer descriptor, process the event.
    if (peerDescriptor)
    {
        // Process the stream by which session it's on.
        if (session == _serverSession)
        {
            // When we receive the client output steam, it becomes the server input stream.
            if ([streamName isEqualToString:CLIENT_OUTPUT_STREAM])
            {
                // Set the server input stream.
                [peerDescriptor setServerInputStream:inputStream];

                // Unlock.
                pthread_mutex_unlock(&_mutex);
                
                // Notify the delegate that the peer client is connected.
                if ([[self delegate] respondsToSelector:@selector(peerNetworking:peerClientConnectedWithPeerIdentifier:)])
                {
                    [[self delegate] peerNetworking:self
              peerClientConnectedWithPeerIdentifier:[peerDescriptor peerIdentifier]];
                }

                // Done.
                return;
            }
            else
            {
                NSLog(@"CAN'T HAPPEN!");
            }
        }
        else if (session == _clientSession)
        {
            // When we receive the server output steam, it becomes the client input stream.
            if ([streamName isEqualToString:SERVER_OUTPUT_STREAM])
            {
                // Set the client input stream.
                [peerDescriptor setClientInputStream:inputStream];
                
                // Unlock.
                pthread_mutex_unlock(&_mutex);
                
                // Notify the delegate that the peer client is connected to the peer server.
                if ([[self delegate] respondsToSelector:@selector(peerNetworking:connectedToPeerServerWithPeerIdentifier:)])
                {
                    [[self delegate] peerNetworking:self
            connectedToPeerServerWithPeerIdentifier:[peerDescriptor peerIdentifier]];
                }
                
                // Done.
                return;
            }
            else
            {
                NSLog(@"CAN'T HAPPEN!");
            }
        }
        else
        {
            NSLog(@"CAN'T HAPPEN!");
        }
    }
    
    // Unlock.
    pthread_mutex_unlock(&_mutex);
}

// Notifies the delegate that the state of a nearby peer changed.
- (void)session:(MCSession *)session
           peer:(MCPeerID *)peerID
 didChangeState:(MCSessionState)state
{
    // Lock.
    pthread_mutex_lock(&_mutex);

    // Find the peer descriptor.
    THEPeerDescriptor * peerDescriptor = (THEPeerDescriptor *)_peers[peerID];
    
    // If we found the peer descriptor, process the event.
    if (peerDescriptor)
    {
        if (session == _serverSession)
        {
            // Log.
            switch (state)
            {
                // Not connected.
                case MCSessionStateNotConnected:
                {
                    // Update the server state.
                    [peerDescriptor setServerState:THEPeerDescriptorStateNotConnected];
                    [peerDescriptor setServerInputStream:nil];
                    [peerDescriptor setServerOutputStream:nil];
                    
                    // Unlock.
                    pthread_mutex_unlock(&_mutex);
                    
                    // Notify the delegate.
                    if ([[self delegate] respondsToSelector:@selector(peerNetworking:peerClientNotConnectedWithPeerIdentifier:)])
                    {
                        [[self delegate] peerNetworking:self
               peerClientNotConnectedWithPeerIdentifier:[peerDescriptor peerIdentifier]];
                    }
                    
                    // Done.
                    return;
                }
                    
                // Connecting.
                case MCSessionStateConnecting:
                {
                    // Update the state.
                    [peerDescriptor setServerState:THEPeerDescriptorStateConnecting];
                    
                    // Unlock.
                    pthread_mutex_unlock(&_mutex);
                    
                    // Notify the delegate.
                    if ([[self delegate] respondsToSelector:@selector(peerNetworking:peerClientConnectingWithPeerIdentifier:)])
                    {
                        [[self delegate] peerNetworking:self
                 peerClientConnectingWithPeerIdentifier:[peerDescriptor peerIdentifier]];
                    }

                    // Done.
                    return;
                }
                    
                // Connected.
                case MCSessionStateConnected:
                {
                    // Start the server output stream.
                    NSError * error;
                    NSOutputStream * serverOutputStream = [_serverSession startStreamWithName:SERVER_OUTPUT_STREAM
                                                                                       toPeer:peerID
                                                                                        error:&error];
                    if (serverOutputStream)
                    {
                        // Set the server output stream. (Where we write data for the client.)
                        [peerDescriptor setServerOutputStream:serverOutputStream];
                        
                        // Unlock.
                        pthread_mutex_unlock(&_mutex);
                    }
                    else
                    {
                        // Unlock.
                        pthread_mutex_unlock(&_mutex);
                        
                        // Cancel the connection to the peer.
                        [_serverSession cancelConnectPeer:peerID];
                    }

                    // Done.
                    return;
                }
            }
        }
        else if (session == _clientSession)
        {
            // Log.
            switch (state)
            {
                // Not connected.
                case MCSessionStateNotConnected:
                {
                    // Update the peer descriptor.
                    [peerDescriptor setClientState:THEPeerDescriptorStateNotConnected];
                    [peerDescriptor setClientOutputStream:nil];
                    [peerDescriptor setClientInputStream:nil];
                    
                    // Unlock.
                    pthread_mutex_unlock(&_mutex);
                    
                    // Notify the delegate.
                    if ([[self delegate] respondsToSelector:@selector(peerNetworking:notConnectedToPeerServerWithPeerIdentifier:)])
                    {
                        [[self delegate] peerNetworking:self
             notConnectedToPeerServerWithPeerIdentifier:[peerDescriptor peerIdentifier]];
                    }

                    // Done.
                    return;
                }
                    
                // Connecting.
                case MCSessionStateConnecting:
                {
                    // Update the state.
                    [peerDescriptor setClientState:THEPeerDescriptorStateConnecting];
                    
                    // Unlock.
                    pthread_mutex_unlock(&_mutex);
                    
                    // Notify the delegate.
                    if ([[self delegate] respondsToSelector:@selector(peerNetworking:connectingToPeerServerWithPeerIdentifier:)])
                    {
                        [[self delegate] peerNetworking:self
               connectingToPeerServerWithPeerIdentifier:[peerDescriptor peerIdentifier]];
                    }
                    
                    // Done.
                    return;
                }
                    
                // Connected.
                case MCSessionStateConnected:
                {
                    // Start the client output stream. (Where we write data for the server.)
                    NSError * error;
                    NSOutputStream * clientOutputStream = [_clientSession startStreamWithName:CLIENT_OUTPUT_STREAM
                                                                                       toPeer:peerID
                                                                                        error:&error];
                    if (clientOutputStream)
                    {
                        // Set the client output stream.
                        [peerDescriptor setClientOutputStream:clientOutputStream];
                        
                        // Unlock.
                        pthread_mutex_unlock(&_mutex);
                    }
                    else
                    {
                        // Unlock.
                        pthread_mutex_unlock(&_mutex);
                        
                        // Cancel the connection to the peer.
                        [_clientSession cancelConnectPeer:peerID];
                    }

                    // Done.
                    return;
                }
            }
        }
    }
    
    // Unlock.
    pthread_mutex_unlock(&_mutex);
}

// Notifies the delegate to validate the client certificate provided by a nearby peer when a connection is first established.
- (void)session:(MCSession *)session
didReceiveCertificate:(NSArray *)certificate
       fromPeer:(MCPeerID *)peerID
certificateHandler:(void (^)(BOOL accept))certificateHandler
{
    certificateHandler(YES);
}

@end

// THEPeerNetworking (Internal) implementation.
@implementation THEPeerNetworking (Internal)
@end
