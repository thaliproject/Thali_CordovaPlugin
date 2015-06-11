//
//  THEPeer.h
//  ThaliMobile
//
//  Created by Brian Lambert on 5/12/15.
//
//

#import <Foundation/Foundation.h>
#import <CoreLocation/CoreLocation.h>

// THEPeerState enumeration.
typedef NS_ENUM(NSUInteger, THEPeerState)
{
    THEPeerStateUnavailable     = 0,
    THEPeerStateAvailable       = 1,
    THEPeerStateConnecting      = 2,
    THEPeerStateConnectFailed   = 3,
    THEPeerStateConnected       = 4,
    THEPeerStateDisconnected    = 5,
};

// THEPeer interface.
@interface THEPeer : NSObject

// Properties.
@property (nonatomic, readonly) NSUUID * identifier;
@property (nonatomic, readonly) NSString * name;
@property (nonatomic) BOOL available;

// Class initializer.
- (instancetype)initWithIdentifier:(NSUUID *)peerIdentifier
                              name:(NSString *)name;

// Converts THEPeer to JSON.
- (NSString *)JSON;

@end
