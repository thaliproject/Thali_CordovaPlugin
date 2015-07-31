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
//  THEMultipeerServer.m

#import "THEMultipeerServer.h"
#import "THEProtectedMutableDictionary.h"

static NSString * const PEER_NAME_KEY        = @"PeerName";
static NSString * const PEER_IDENTIFIER_KEY  = @"PeerIdentifier";
static NSString * const SERVER_OUTPUT_STREAM = @"ServerOutputStream";
static NSString * const CLIENT_OUTPUT_STREAM = @"ClientOutputStream";

@implementation MultipeerServer
{
    MCPeerID * _peerId;
    MCSession * _serverSession;

    uint _serverPort;
    THEProtectedMutableDictionary *_clients;

    MCNearbyServiceAdvertiser * _nearbyServiceAdvertiser;
}

-(id) initWithPeerId:(MCPeerID *)peerId 
    withPeerIdentifier:(NSString *)peerIdentifier 
          withPeerName:(NSString *)peerName
       withServiceType:(NSString *)serviceType
{
    self = [super init];
    if (!self)
    {
        return nil;
    }

    // Init the basic multipeer server session

    _peerId = peerId;

    // peer name doubles up as server port in current impl.
    // This is the port the node server is listening to on localhost
    _serverPort = [peerName intValue];

    _serverSession = [[MCSession alloc] initWithPeer:_peerId];
    _serverSession.delegate = self;
   
    // Keep track of the clients we've seen 
    _clients = [[THEProtectedMutableDictionary alloc] init];
    
    _nearbyServiceAdvertiser = [[MCNearbyServiceAdvertiser alloc] 
        initWithPeer:peerId 
        discoveryInfo:@{ PEER_IDENTIFIER_KEY: peerIdentifier, PEER_NAME_KEY: peerName } 
        serviceType:serviceType
    ];

    [_nearbyServiceAdvertiser setDelegate:self];

    return self;
}

-(void) start
{
    NSLog(@"server starting..");
    [_nearbyServiceAdvertiser startAdvertisingPeer];
}

-(void) stop
{
    [_serverSession disconnect];
    [_nearbyServiceAdvertiser stopAdvertisingPeer];
    _nearbyServiceAdvertiser = nil;
}

// MCNearbyServiceAdvertiserDelegate
////////////////////////////////////

- (void)advertiser:(MCNearbyServiceAdvertiser *)advertiser
    didReceiveInvitationFromPeer:(MCPeerID *)peerID
                     withContext:(NSData *)context
               invitationHandler:(void (^)(BOOL accept, MCSession * session))invitationHandler
{
    NSLog(@"server: didReceiveInvitationFromPeer");

    [_clients createWithKey:peerID createBlock:^NSObject *(NSObject *oldValue) {

        THEClientPeerDescriptor *descriptor = (THEClientPeerDescriptor *)oldValue;

        if (descriptor && ([descriptor.peerID hash] == [peerID hash]))
        {
            NSLog(@"server: existing peer");
            [session cancelConnectPeer:peerID];
        }
        return [[THEClientPeerDescriptor alloc] initWithPeerID:peerID withServerPort:_serverPort ]; 
    }];

    invitationHandler(YES, _serverSession);
}

- (void)advertiser:(MCNearbyServiceAdvertiser *)advertiser didNotStartAdvertisingPeer:(NSError *)error
{
    NSLog(@"WARNING: server didNotStartAdvertisingPeer");
}

// MCSessionDelegate
////////////////////

- (void)session:(MCSession *)session didReceiveData:(NSData *)data fromPeer:(MCPeerID *)peerID
{
}

- (void)session:(MCSession *)session
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
    NSLog(@"server: didReceiveStream");

    [_clients updateWithKey: peerID updateBlock:^void(NSObject *v) {

        THEClientPeerDescriptor *peerDescriptor = 
            (THEClientPeerDescriptor *)([v isKindOfClass:[THEClientPeerDescriptor class]] ? v : Nil);

        if (!peerDescriptor)
        {
            // Unknown peer
            return;
        }
     
        if ([streamName isEqualToString:CLIENT_OUTPUT_STREAM])
        {
            [peerDescriptor setInputStream:inputStream];
        }
        else
        {
            NSLog(@"CAN'T HAPPEN!");
        }

        return;
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
    [_clients updateWithKey: peerID updateBlock:^void(NSObject *v) {

        THEClientPeerDescriptor *peerDescriptor = 
            (THEClientPeerDescriptor *)([v isKindOfClass:[THEClientPeerDescriptor class]] ? v : Nil);

        if (!peerDescriptor)
        {
            // Unknown peer
            return;
        }
        
        switch (state)
        {
            // Not connected.
            case MCSessionStateNotConnected:
            {
                [peerDescriptor setConnectionState:THEPeerDescriptorStateNotConnected];
                [peerDescriptor setInputStream:nil];
                [peerDescriptor setOutputStream:nil];
                [peerDescriptor.serverRelay stop];
                peerDescriptor.serverRelay = nil;
            }
            break;

            // Connecting.
            case MCSessionStateConnecting:
            {
                [peerDescriptor setConnectionState:THEPeerDescriptorStateConnecting];
            }
            break;

            // Connected.
            case MCSessionStateConnected:
            {
                NSLog(@"server: session connected");

                // Start the server output stream.
                NSError * error;
                NSOutputStream * outputStream = [session startStreamWithName:SERVER_OUTPUT_STREAM
                                                                      toPeer:peerID
                                                                       error:&error];
                if (outputStream)
                {
                    // Set the server output stream. (Where we write data for the client.)
                    [peerDescriptor setOutputStream:outputStream];
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

