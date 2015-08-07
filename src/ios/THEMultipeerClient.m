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

@implementation MultipeerClient
{
    MCPeerID * _peerId;
    MCSession * _clientSession;
    MCNearbyServiceBrowser * _nearbyServiceBrowser;

    THEProtectedMutableDictionary *_servers;

    id<THEPeerNetworkingDelegate>  _peerNetworkingDelegate;
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

    _clientSession = [[MCSession alloc] 
        initWithPeer: _peerId securityIdentity:nil encryptionPreference:MCEncryptionNone
    ];
    [_clientSession setDelegate:self];

    _servers = [[THEProtectedMutableDictionary alloc] init];

    _peerNetworkingDelegate = peerNetworkingDelegate;

    _nearbyServiceBrowser = [[MCNearbyServiceBrowser alloc] initWithPeer:peerId serviceType:serviceType];
    [_nearbyServiceBrowser setDelegate:self];

    return self;
}

-(void) start
{
    NSLog(@"client starting..");
    [_nearbyServiceBrowser startBrowsingForPeers];
}

-(void) stop
{
    [_clientSession disconnect];
    [_nearbyServiceBrowser stopBrowsingForPeers];
    _nearbyServiceBrowser = nil;
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

        THEServerPeerDescriptor *serverDescriptor = (THEServerPeerDescriptor *)v;
        if ([serverDescriptor connectionState] == THEPeerDescriptorStateNotConnected)
        {
            success = YES;
            NSLog(@"client: inviting peer");
            [_nearbyServiceBrowser invitePeer:[serverDescriptor peerID]
                                    toSession:_clientSession
                                  withContext:nil
                                      timeout:60];
        }
        else
        {
            NSLog(@"client: already connecting to %@", peerIdentifier);
        }

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

        THEServerPeerDescriptor *serverDescriptor = (THEServerPeerDescriptor *)v;
        if ([serverDescriptor connectionState] != THEPeerDescriptorStateNotConnected)
        {
            NSLog(@"client: disconnecting peer: %@", peerIdentifier);

            success = (serverDescriptor != nil);
            [_clientSession cancelConnectPeer:[serverDescriptor peerID]];
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

                [serverDescriptor.clientRelay stop];
                serverDescriptor.clientRelay = nil;

                [serverDescriptor setConnectionState:THEPeerDescriptorStateNotConnected];
                [serverDescriptor setOutputStream:nil];
                [serverDescriptor setInputStream:nil];
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
