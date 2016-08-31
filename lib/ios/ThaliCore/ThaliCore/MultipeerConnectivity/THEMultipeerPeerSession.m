//
//  THEMultipeerSession.m
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import "THEAppContext.h"
#import "THEMultipeerPeerSession.h"
#import "THEMultipeerSocketRelay.h"

static NSString * const THALI_STREAM = @"ThaliStream";

@interface THEMultipeerPeerSession()
- (THEMultipeerSocketRelay *)newSocketRelay;
@end

@implementation THEMultipeerPeerSession
{
  MCSession * _session;
  THEMultipeerSocketRelay *_relay;

  MCPeerID * _localPeerID;
  MCPeerID * _remotePeerID;
  NSString * _remotePeerIdentifier;

  THEPeerSessionState _connectionState;

  // Debugging purposes only
  NSString * _sessionType;
}

static NSDictionary *stateChanges = nil;

+ (void)initialize 
{
  if (self == [THEMultipeerPeerSession class]) {
    // Static initialisation
    stateChanges = @{ 
      @(THEPeerSessionStateNotConnected) : @[@(THEPeerSessionStateConnecting)],
      @(THEPeerSessionStateConnecting) : 
        @[@(THEPeerSessionStateNotConnected), @(THEPeerSessionStateConnected)],
      @(THEPeerSessionStateConnected) : @[@(THEPeerSessionStateNotConnected)]
    };
  }
}

- (instancetype)initWithLocalPeerID:(MCPeerID *)localPeerID
                   withRemotePeerID:(MCPeerID *)remotePeerID
           withRemotePeerIdentifier:(NSString *)remotePeerIdentifier
                    withSessionType:(NSString *)sessionType
{
  self = [super init];
  if (!self)
  {
      return nil;
  }
    
  _localPeerID = localPeerID;
  _remotePeerID = remotePeerID;
  _remotePeerIdentifier = remotePeerIdentifier;
 
  _sessionType = sessionType;
  _connectionState = THEPeerSessionStateNotConnected;

  return self;
}

- (void)changeState:(THEPeerSessionState)newState
{
  @synchronized(self)
  {
    assert([stateChanges[@(_connectionState)] containsObject:@(newState)]);
    NSLog(@"%@ session: stateChange:%lu->%lu %@", 
      _sessionType, (unsigned long)_connectionState, (unsigned long)newState, _remotePeerIdentifier
    );
    _connectionState = newState;
  }
}

- (void)dealloc
{
  assert(_connectionState == THEPeerSessionStateNotConnected);
}

- (MCPeerID *)remotePeerID
{
  return _remotePeerID;
}

- (NSString *)remotePeerIdentifier
{
  return _remotePeerIdentifier;
}

- (void)updateRemotePeerIdentifier:(NSString *)remotePeerIdentifier
{
  _remotePeerIdentifier = remotePeerIdentifier;
}

- (NSString *)remotePeerUUID
{
  return [THEMultipeerPeerSession peerUUIDFromPeerIdentifier:_remotePeerIdentifier];
}

+ (NSString *)peerUUIDFromPeerIdentifier:(NSString *)peerIdentifier
{
  NSString *uuid = [peerIdentifier componentsSeparatedByString:@":"][0];
  return uuid;
}

- (THEPeerSessionState)connectionState
{
  return _connectionState;
}

-(void)setInputStream:(NSInputStream *)inputStream
{
  assert(_relay);
  [_relay setInputStream:inputStream];
}

-(void)setOutputStream:(NSOutputStream *)outputStream
{
  assert(_relay);
  [_relay setOutputStream:outputStream];
}

-(MCSession *)session
{
  return _session;
}

-(void)connect
{
  @synchronized(self)
  {
    // Create the transport session and relay, we're not yet fully connected though

    assert(_relay == nil && _session == nil);

    NSLog(@"%@ session: connect", _sessionType);
    [self changeState:THEPeerSessionStateConnecting];

    _relay = [self newSocketRelay];

    _session = [[MCSession alloc] initWithPeer:_localPeerID 
                              securityIdentity:nil 
                          encryptionPreference:MCEncryptionNone];
    _session.delegate = self;
  }
}

-(void)reverseConnect
{
  @synchronized(self)
  {
    // Create the transport session, not the relay.
    // We don't expect this session to ever complete

    assert(_relay == nil && _session == nil);

    NSLog(@"%@ session: reverseConnect", _sessionType);
    [self changeState:THEPeerSessionStateConnecting];

    _session = [[MCSession alloc] initWithPeer:_localPeerID
                              securityIdentity:nil 
                          encryptionPreference:MCEncryptionNone];
    _session.delegate = self;
  }
}

-(void)disconnect
{
  @synchronized(self)
  {
    // Free up the resources we need for an active connection

    if (_connectionState == THEPeerSessionStateNotConnected)
      return;

    NSLog(@"%@ session: disconnect", _sessionType);
    [self changeState:THEPeerSessionStateNotConnected];

    if (_relay != nil)
    {
      [_relay stop];    
      _relay = nil;
    }

    if (_session != nil)
    {
      _session.delegate = nil;
      [_session disconnect];
      _session = nil;
    }
  }
}

-(void)kill
{
  // Disconnect without being polite, testing only !!
  @synchronized(self)
  {
    [_session disconnect];
  }
}

-(THEMultipeerSocketRelay *)newSocketRelay
{
  return nil;
}

- (void)onLinkFailure
{
  // Nothing for base/server class to do here
}

- (const THEMultipeerSocketRelay *)relay
{
  return _relay;
}

// MCSessionDelegate
/////////////////////

- (void)session:(MCSession *)session
  didReceiveStream:(NSInputStream *)inputStream
          withName:(NSString *)streamName
          fromPeer:(MCPeerID *)peerID
{
  if ([streamName isEqualToString:THALI_STREAM])
  {
      [self setInputStream:inputStream];
  }
  else
  {
      NSLog(@"WARNING: Unexpected stream name");
  }
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
  assert(session == _session);

  switch (state)
  {
    case MCSessionStateNotConnected:
    {
      NSLog(@"%@ session: not connected %@", _sessionType, _remotePeerIdentifier);
      [self onLinkFailure];
    }
    break;

    case MCSessionStateConnecting:
    {
      //NSLog(@"%@ session: connecting", _sessionType);
      assert(_connectionState == THEPeerSessionStateConnecting);
    }
    break;

    case MCSessionStateConnected:
    {
      //NSLog(@"%@ session: connected", _sessionType);

      @synchronized(self)
      {
        NSLog(@"%@ session: p2p link connected", _sessionType);

        // Start the server output stream.
        NSError * error;
        NSOutputStream * outputStream = [_session startStreamWithName:THALI_STREAM
                                                               toPeer:peerID
                                                                error:&error];
        if (outputStream)
        {
          // Set the server output stream. (Where we write data for the client.)
          [self setOutputStream:outputStream];
        }
        else
        {
          NSLog(@"%@ no output stream", _sessionType);
          [_session cancelConnectPeer:peerID];
          [self disconnect];
        }
      }
    }
    break;

    default:
    {
      NSLog(@"WARNING: Unexpected case statement");
    }
    break;
  }
}

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

@end

