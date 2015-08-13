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
//  THEMultipeerClient.m

#import "THEMultipeerClient.h"
#import "THEProtectedMutableDictionary.h"

static NSString * const PEER_NAME_KEY        = @"PeerName";
static NSString * const PEER_IDENTIFIER_KEY  = @"PeerIdentifier";
static NSString * const SERVER_OUTPUT_STREAM = @"ServerOutputStream";
static NSString * const CLIENT_OUTPUT_STREAM = @"ClientOutputStream";

static const uint MAX_CONNECT_RETRIES = 5;

@interface MultipeerClient()
    -(BOOL) tryInviteToSessionWithPeerDescriptor:(THEServerPeerDescriptor *)serverDescriptor;
@end

@implementation MultipeerClient
{
    // Transport level identifier
    MCPeerID * _peerId;

    // The multipeer browser
    MCNearbyServiceBrowser * _nearbyServiceBrowser;

    // Application level service info
    NSString *_serviceType;

    // Delegate that will be informed when we discover a server
    id<THEPeerNetworkingDelegate>  _peerNetworkingDelegate;

    // Map of discovered servers
    THEProtectedMutableDictionary *_servers;
}

-(id) initWithPeerId:(MCPeerID *)peerId withServiceType:(NSString *)serviceType 
                             withPeerNetworkingDelegate:(id<THEPeerNetworkingDelegate>)peerNetworkingDelegate
{
    self = [super init];
    if (!self)
    {
        return nil;
    }

    // Init the basic multipeer client session

    _peerId = peerId;
    _serviceType = serviceType;

    _peerNetworkingDelegate = peerNetworkingDelegate;

    return self;
}

-(void) start
{
    NSLog(@"client starting..");

    _servers = [[THEProtectedMutableDictionary alloc] init];

    _nearbyServiceBrowser = [[MCNearbyServiceBrowser alloc] initWithPeer:_peerId serviceType:_serviceType];
    [_nearbyServiceBrowser setDelegate:self];

    [_nearbyServiceBrowser startBrowsingForPeers];
}

-(void) stop
{
    [_nearbyServiceBrowser stopBrowsingForPeers];
    _nearbyServiceBrowser = nil;

    _servers = nil;
}

-(BOOL) tryInviteToSessionWithPeerDescriptor:(THEServerPeerDescriptor *)serverDescriptor
{
    // DON'T CALL THIS OUTSIDE A LOCK

    if ([serverDescriptor connectionState] == THEPeerDescriptorStateNotConnected)
    {
        serverDescriptor.connectRetries--;
        if (serverDescriptor.connectRetries > 0)
        {
            NSLog(@"client: inviting peer");
            [_nearbyServiceBrowser invitePeer:[serverDescriptor peerID]
                                    toSession:serverDescriptor.clientSession
                                  withContext:nil
                                      timeout:60];
            return YES;
        }
        else
        {
            NSLog(@"client: max connect retries exceeded");
        }
    }
    else
    {
        NSLog(@"client: already connect(ing/ed)");
    }

    return NO;
}

-(BOOL) connectToPeerWithPeerIdentifier:(NSString *)peerIdentifier
{
    __block BOOL success = NO;

    BOOL (^filterBlock)(NSObject *peer) = ^BOOL(NSObject *v) {
        // Search for the peer with matching peerIdentifier
        THEServerPeerDescriptor *serverDescriptor = 
            (THEServerPeerDescriptor *)([v isKindOfClass:[THEServerPeerDescriptor class]] ? v : Nil);
        return serverDescriptor && [serverDescriptor.peerIdentifier isEqualToString:peerIdentifier];
    };

    [_servers updateWithFilter:filterBlock updateBlock:^BOOL(NSObject *v) {

        // Called only when v == matching peer
        THEServerPeerDescriptor *serverDescriptor = (THEServerPeerDescriptor *)v;

        // Create a fresh session each time, things get flaky if we don't do this.
        serverDescriptor.clientSession = [[MCSession alloc] 
            initWithPeer: _peerId securityIdentity:nil encryptionPreference:MCEncryptionNone
        ];
        [serverDescriptor.clientSession setDelegate:self];

        // Start connection process from the top
        serverDescriptor.connectRetries = MAX_CONNECT_RETRIES;
        success = [self tryInviteToSessionWithPeerDescriptor:serverDescriptor];

        // Stop iterating
        return NO;
    }];

    return success;
}

-(BOOL) disconnectFromPeerWithPeerIdentifier:(NSString *)peerIdentifier
{
    __block BOOL success = NO;

    BOOL (^filterBlock)(NSObject *peer) = ^BOOL(NSObject *v) {
        // Search for the peer with matching peerIdentifier
        THEServerPeerDescriptor *serverDescriptor = 
            (THEServerPeerDescriptor *)([v isKindOfClass:[THEServerPeerDescriptor class]] ? v : Nil);
        return serverDescriptor && [serverDescriptor.peerIdentifier isEqualToString:peerIdentifier];
    };

    [_servers updateWithFilter:filterBlock updateBlock:^BOOL(NSObject *v) {

        // Called only when v == matching peer
        THEServerPeerDescriptor *serverDescriptor = (THEServerPeerDescriptor *)v;
        if ([serverDescriptor connectionState] != THEPeerDescriptorStateNotConnected)
        {
            success = YES;
            [serverDescriptor setConnectionState:THEPeerDescriptorStateNotConnected];

            NSLog(@"client: disconnecting peer: %@", peerIdentifier);
            [serverDescriptor.clientSession disconnect];
        }

        // Stop iterating
        return NO;
    }];
    
    return success; 
}

// MCNearbyServiceBrowserDelegate
/////////////////////////////////

- (void)browser:(MCNearbyServiceBrowser *)browser foundPeer:(MCPeerID *)peerID withDiscoveryInfo:(NSDictionary *)info
{
    __block THEServerPeerDescriptor *serverDescriptor = nil;

    [_servers createWithKey:peerID createBlock: ^NSObject *(NSObject *oldValue) {

        THEServerPeerDescriptor *descriptor = (THEServerPeerDescriptor *)oldValue;

        if (descriptor && ([descriptor.peerID hash] == [peerID hash]))
        {
            NSLog(@"client: Found existing peer: %@", info[PEER_IDENTIFIER_KEY]);

            serverDescriptor = descriptor;
            [serverDescriptor setVisible: YES];

            // Returning nil to indicate we don't need to replace the existing record
            return nil;
        }

        NSLog(@"client: Found new peer: %@", info[PEER_IDENTIFIER_KEY]);

        // We've found a new peer, create a new record
        serverDescriptor = [[THEServerPeerDescriptor alloc] 
            initWithPeerID:peerID withPeerIdentifier:info[PEER_IDENTIFIER_KEY] withPeerName:info[PEER_NAME_KEY]
        ];

        [serverDescriptor setVisible:YES];

        // Return the new descriptor to be stored
        return serverDescriptor;
    }];

    if (serverDescriptor)
    {
        // A new peer or one that has become visible again
        if ([_peerNetworkingDelegate respondsToSelector:@selector(didFindPeerIdentifier:peerName:)])
        {
            [_peerNetworkingDelegate 
                didFindPeerIdentifier:[serverDescriptor peerIdentifier] peerName:[serverDescriptor peerName]
            ];
        }
    }
}

// Notifies the delegate that a peer was lost.
- (void)browser:(MCNearbyServiceBrowser *)browser
       lostPeer:(MCPeerID *)peerID
{
    __block THEServerPeerDescriptor *serverDescriptor = nil;

    [_servers updateWithKey:peerID updateBlock: ^void(NSObject *v) {

        THEServerPeerDescriptor *serverDescriptor = 
            (THEServerPeerDescriptor *)([v isKindOfClass:[THEServerPeerDescriptor class]] ? v : Nil);

        if (serverDescriptor)
        {
            [serverDescriptor setVisible:NO];
            NSLog(@"client: Lost peer: %@", [serverDescriptor peerIdentifier]);
        }
    }];
        
    if (serverDescriptor)
    {
        if ([_peerNetworkingDelegate respondsToSelector:@selector(didLosePeerIdentifier:)])
        {
            [_peerNetworkingDelegate didLosePeerIdentifier:[serverDescriptor peerIdentifier]];
        }
    }
}

- (void)browser:(MCNearbyServiceBrowser *)browser didNotStartBrowsingForPeers:(NSError *)error
{
    NSLog(@"WARNING: didNotStartBrowsingForPeers");
}


// MCSessionDelegate
/////////////////////////////////

-(void)session:(MCSession *)session didReceiveData:(NSData *)data fromPeer:(MCPeerID *)peerID
{
}

- (void) session:(MCSession *)session
         didStartReceivingResourceWithName:(NSString *)resourceName
         fromPeer:(MCPeerID *)peerID
         withProgress:(NSProgress *)progress
{
}

- (void)session:(MCSession *)session
didFinishReceivingResourceWithName:(NSString *)resourceName
       fromPeer:(MCPeerID *)peerID
          atURL:(NSURL *)localURL
      withError:(NSError *)error
{
}

- (void)session:(MCSession *)session
didReceiveStream:(NSInputStream *)inputStream
       withName:(NSString *)streamName
       fromPeer:(MCPeerID *)peerID
{
    // Server has opened their output stream towards us which becomes our
    // input stream. This implies we've already opened our input stream towards
    // them to trigger the reverse connection.

    __block THEServerPeerDescriptor *serverDescriptor = nil;

    [_servers updateWithKey:peerID updateBlock: ^void(NSObject *v) {

        serverDescriptor = (THEServerPeerDescriptor *)([v isKindOfClass:[THEServerPeerDescriptor class]] ? v : Nil);

        if (serverDescriptor)
        {
            NSLog(@"client didReceiveStream: %@", serverDescriptor.peerIdentifier);
            if ([streamName isEqualToString:SERVER_OUTPUT_STREAM])
            {
                [serverDescriptor setInputStream:inputStream];
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
    }];
}

-(void) session:(MCSession *)session didReceiveCertificate:(NSArray *)certificate 
       fromPeer:(MCPeerID *)peerID certificateHandler:(void (^)(BOOL accept))certificateHandler
{
    certificateHandler(YES);
}


- (void)session:(MCSession *)session
           peer:(MCPeerID *)peerID
 didChangeState:(MCSessionState)state
{
    __block THEServerPeerDescriptor *serverDescriptor = nil;

    [_servers updateWithKey:peerID updateBlock: ^void(NSObject *v) {

        serverDescriptor = (THEServerPeerDescriptor *)([v isKindOfClass:[THEServerPeerDescriptor class]] ? v : Nil);

        if (!serverDescriptor)
        {
            NSLog(@"client: Unfound server");
            return;
        }

        switch (state)
        {
            // Not connected.
            case MCSessionStateNotConnected:
            {
                NSLog(@"client: not connected");

                THEPeerDescriptorState prevState = serverDescriptor.connectionState;
                [serverDescriptor disconnect];
                
                if (prevState == THEPeerDescriptorStateConnecting)
                {
                    NSLog(@"client: retrying connection");

                    serverDescriptor.clientSession = [[MCSession alloc] 
                        initWithPeer: _peerId securityIdentity:nil encryptionPreference:MCEncryptionNone
                    ];
                    [serverDescriptor.clientSession setDelegate:self];

                    [self tryInviteToSessionWithPeerDescriptor:serverDescriptor];
                }
            }
            break;
                
            // Connecting.
            case MCSessionStateConnecting:
            {
                NSLog(@"client: connecting");
                [serverDescriptor setConnectionState:THEPeerDescriptorStateConnecting];
            }
            break;

            // Connected.
            case MCSessionStateConnected:
            {
                NSLog(@"client: session connected to %@", serverDescriptor.peerIdentifier);

                NSError * error;
                NSOutputStream * outputStream = [session startStreamWithName:CLIENT_OUTPUT_STREAM
                                                                      toPeer:peerID
                                                                       error:&error];
                if (outputStream)
                {
                    [serverDescriptor setOutputStream:outputStream];
                }
                else
                {
                    [session cancelConnectPeer:peerID];
                }
            }
            break;

            default:
            {
                NSLog(@"WARNING: Unexpected case statement");
            }
            break;
        }
    }];
}

@end
