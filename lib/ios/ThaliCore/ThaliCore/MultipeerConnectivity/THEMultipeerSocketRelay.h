//
//  THEMultipeerSocketRelay.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import "GCDAsyncSocket.h"

// Base class of the networking relay which passes data it receives via the input/output
// streams over the multipeer session to and from the application over a local socket 
// Subclasses differ only in the way the they create the socket. 
@interface THEMultipeerSocketRelay : NSObject <GCDAsyncSocketDelegate, NSStreamDelegate>

// relayType is just the id we'll be logging under and can be anything
- (id)initWithRelayType:(NSString *)relayType;

// Let the subclasses ask us if it's the right time to create a socket
- (BOOL)canCreateSocket;

// Let the subclasses inform us they created (by their different means)
// the socket
- (void)didCreateSocket:(GCDAsyncSocket *)socket;

// Set the input stream from which we'll receive data from the remote peer and pass
// to the application
- (void)setInputStream:(NSInputStream *)inputStream;

// Set the output stream via which we'll send data we received from the application to
// the remote peer
- (void)setOutputStream:(NSOutputStream *)outputStream;

// Ensure orderly close of the streams else bad things happen when we dealloc
- (void)stop;

@end
