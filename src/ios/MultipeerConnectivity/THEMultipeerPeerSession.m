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
//  THEMultipeerSession.m
//

#import "THEAppContext.h"
#import "THEMultipeerPeerSession.h"
#import "THEMultipeerSocketRelay.h"

static NSString * const THALI_STREAM = @"ThaliStream";

@interface THEMultipeerPeerSession()
- (THEMultipeerSocketRelay *)createRelay;
@end

@implementation THEMultipeerPeerSession
{
  MCSession * _session;
  THEMultipeerSocketRelay *_relay;

  NSString * _peerIdentifier;

  // Debugging purposes only
  NSString * _sessionType;
}

- (instancetype)initWithPeerID:(MCPeerID *)peerID 
            withPeerIdentifier:(NSString *)peerIdentifier 
               withSessionType:(NSString *)sessionType
{
  self = [super init];
  if (!self)
  {
      return nil;
  }
    
  _peerID = peerID;
  _peerIdentifier = peerIdentifier;
  
  _sessionType = sessionType;

  NSLog(@"%@ session init: %@", _peerIdentifier, _sessionType);

  return self;
}

-(void)dealloc
{
  NSLog(@"%@ session: dealloc %@", _sessionType, _peerIdentifier);
  [self disconnect];
}

-(NSString *)peerIdentifier
{
  return _peerIdentifier;
}

-(void)setInputStream:(NSInputStream *)inputStream
{
  [_relay setInputStream:inputStream];
}

-(void)setOutputStream:(NSOutputStream *)outputStream
{
  [_relay setOutputStream:outputStream];
}

-(MCSession *)session
{
  return _session;
}

-(MCSession *)connect
{
  @synchronized(self)
  {
    NSLog(@"%@ session base connect %@", _sessionType, [self peerIdentifier]);

    // Create the session and relay, we're not yet fully connected though

    assert(_relay == nil && _session == nil);

    _connectionState = THEPeerSessionStateConnecting;

    _relay = [self createRelay];

    _session = [[MCSession alloc] initWithPeer: _peerID 
                              securityIdentity:nil 
                          encryptionPreference:MCEncryptionNone];
    _session.delegate = self;

    return _session;
  }
}

-(void)disconnect
{
  @synchronized(self)
  {
    NSLog(@"%@ session base disconnect %@", _sessionType, [self peerIdentifier]);

    _connectionState = THEPeerSessionStateNotConnected;

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

-(THEMultipeerSocketRelay *)createRelay
{
  return nil;
}

// MCSessionDelegate
/////////////////////

- (void)session:(MCSession *)session
  didReceiveStream:(NSInputStream *)inputStream
          withName:(NSString *)streamName
          fromPeer:(MCPeerID *)peerID
{
  NSLog(@"%@ session: didReceiveStream", _sessionType);

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
      NSLog(@"%@ session: not connected", _sessionType);
      [self disconnect];
    }
    break;

    case MCSessionStateConnecting:
    {
      NSLog(@"%@ session: connecting", _sessionType);
      assert(_connectionState == THEPeerSessionStateConnecting);
    }
    break;

    case MCSessionStateConnected:
    {
      NSLog(@"%@ session: connected", _sessionType);

      _connectionState = THEPeerSessionStateConnected;

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
        [_session cancelConnectPeer:peerID];
        [self disconnect];
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

