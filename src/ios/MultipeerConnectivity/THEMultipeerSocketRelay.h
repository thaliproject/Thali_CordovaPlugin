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
//  THEMultipeerSocketRelay.h
//

#import "../GCDAsyncSocket/GCDAsyncSocket.h"

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
