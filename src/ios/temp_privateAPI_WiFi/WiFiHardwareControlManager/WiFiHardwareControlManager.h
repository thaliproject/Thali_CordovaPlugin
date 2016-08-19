//
//  WiFiHardwareControlManager.h
//  ThaliTest
//
//  Created by Dersim Davaod on 8/18/16.
//
//

#ifndef WiFiHardwareControlManager_h
#define WiFiHardwareControlManager_h

#import <Foundation/Foundation.h>

@interface WiFiHardwareControlManager : NSObject

+ (WiFiHardwareControlManager *)sharedInstance;
- (void)turnWiFiOn;

@end


#endif /* WiFiHardwareControlManager_h */
