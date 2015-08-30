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
//  THESessionDictionary.m
//

#import "THESessionDictionary.h"

@implementation THESessionDictionary
{
  NSMutableDictionary *_peerIdentifiers;
}

- (instancetype) init
{
  if ((self = [super init]))
  {
    _peerIdentifiers = [[NSMutableDictionary alloc] init];
  }
  return self;
}

- (void)dealloc
{
  // Sanity check we cleaned everything up
  for (id peerIdentifier in _peerIdentifiers) {
    [self updateForPeerIdentifier:peerIdentifier 
                      updateBlock:^THEMultipeerPeerSession *(THEMultipeerPeerSession *p) {
      if (p.connectionState != THEPeerSessionStateNotConnected)
      {
        [p disconnect];
      }
      assert(p.connectionState == THEPeerSessionStateNotConnected);
      return nil;
    }];
  }
}

- (void)updateForPeerID:(MCPeerID *)peerID
           updateBlock:(THEMultipeerPeerSession *(^)(THEMultipeerPeerSession *))updateBlock;
{
  // Wrap the update block in another block
  THEMultipeerPeerSession*(^updateWrapper)(THEMultipeerPeerSession *) = 
    ^THEMultipeerPeerSession *(THEMultipeerPeerSession *v) {

    // Capture the return of the updateBlock so we can maintain a dictionary of
    // peerIdentifier->peerID (the base key type). All this to avoid the possibility
    // of storing duplicate peerIdentifers (which we couldn't do by simply making them the key
    // since the framework doesn't talk to us in those terms)

    THEMultipeerPeerSession *session = updateBlock(v);

    if (session == nil)
    {
      // session object is about to be removed from the base dict, remove the 
      // corresponding mapping from it's peerIdentifier

      NSString *peerIdentifier = _peerIdentifiers[peerID];

      if (peerIdentifier != nil)
      {
        // Object has been removed
        [_peerIdentifiers removeObjectForKey:peerIdentifier];
      }
    }
    else
    {
      // update our mapping, usual case is no change
      _peerIdentifiers[[session remotePeerIdentifier]] = peerID;
    }

    return session;
  };

  [super updateForKey:peerID updateBlock:(NSObject *(^)(NSObject *))updateWrapper];  
}

-(void)updateForPeerIdentifier:(NSString *)peerIdentifier
                   updateBlock:(THEMultipeerPeerSession *(^)(THEMultipeerPeerSession *))updateBlock;
{
  [self updateForPeerID:_peerIdentifiers[peerIdentifier] updateBlock:updateBlock];
}

@end

