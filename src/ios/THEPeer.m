//
//  THEPeer.m
//  ThaliMobile
//
//  Created by Brian Lambert on 5/12/15.
//
//

#import "THEPeer.h"

// THEPeer (Internal) interface.
@interface THEPeer (Internal)
@end

// THEPeer implementation.
@implementation THEPeer
{
@private
}

// Class initializer.
- (instancetype)initWithIdentifier:(NSUUID *)identifier
                              name:(NSString *)name
{
    // Initialize superclass.
    self = [super init];
    
    // Handle errors.
    if (!self)
    {
        return nil;
    }
    
    // Initialize.
    _identifier = identifier;
    _name = name;
    
    // Done.
    return self;
}

// Converts THEPeer to JSON.
- (NSString *)JSON
{
    return [NSString stringWithFormat:@"[ { \"peerIdentifier\": \"%@\", \"peerName\": \"%@\", \"peerAvailable\": %@ } ]",
            [[self identifier] UUIDString],
            [self name],
            [self available] ? @"true" : @"false"];
}

@end

// THEPeer (Internal) implementation.
@implementation THEPeer (Internal)
@end
