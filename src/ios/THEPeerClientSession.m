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
//  THEPeerClientSession.m
//

#import "THEAppContext.h"
#import "THEPeerClientSession.h"
#import "THENetworkingClientRelay.h"

@implementation THEPeerClientSession
{
  MCPeerID *_remotePeerID;
  NSString *_remotePeerIdentifier;
}

- (instancetype)initWithLocalPeerID:(MCPeerID *)localPeerID
                   withRemotePeerID:(MCPeerID *)remotePeerID
           withRemotePeerIdentifier:(NSString *)remotePeerIdentifier
{
  self = [super initWithPeerID:localPeerID withSessionType:@"server"];
  if (!self)
  {
      return nil;
  }

  _remotePeerID = remotePeerID;
  _remotePeerIdentifier = remotePeerIdentifier;

  return self;
}

-(MCPeerID *)peerID
{
  return _remotePeerID;
}

-(NSString *)peerIdentifier
{
  return _remotePeerIdentifier;
}

- (THENetworkingRelay *)createRelay
{
  THENetworkingClientRelay *clientRelay = [
    [THENetworkingClientRelay alloc] initWithPeerIdentifier:_remotePeerIdentifier
  ];
  [clientRelay setDelegate:(id<THESocketServerDelegate>)[THEAppContext singleton]];

  return clientRelay;
}

@end


