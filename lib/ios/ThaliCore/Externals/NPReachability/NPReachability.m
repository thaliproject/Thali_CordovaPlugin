//
//  NPReachability.h
//
//  Updated and converted to ARC by Abizer Nasir.
//  
//  Copyright (c) 2011, Nick Paulson
//  All rights reserved.
//  
//  Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
//  
//  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
//  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
//  Neither the name of the Nick Paulson nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
//  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//

#import "NPReachability.h"

const struct NPReachabilityKeysStruct NPReachabilityKeys = {
    .currentlyReachable = @"currentlyReachable",
    .currentReachabilityFlags = @"currentReachabilityFlags",
    .currentNetworkStatus = @"currentNetworkStatus"

};

NSString * const NPReachabilityChangedNotification = @"NPReachabilityChangedNotification";

@interface NPReachability ()

@property (strong, nonatomic) NSMutableDictionary *handlerByOpaqueObject;
@property (assign, nonatomic) SCNetworkReachabilityRef reachabilityRef;
@property (nonatomic, readwrite) SCNetworkReachabilityFlags currentReachabilityFlags;

@end


@implementation NPReachability

#pragma mark - Singleton Methods

+ (void)load {
    [super load];
    
    // Attempt to initialize the shared instance so that NSNotifications are 
    // sent even if you never initialize the class
    @autoreleasepool {
        [NPReachability sharedInstance];
    }
}

+ (NPReachability *)sharedInstance {
    static NPReachability *sharedInstance;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[self alloc] init];
    });
    return sharedInstance;
}

#pragma mark - Set up and tear down

- (id)init {
    // DO NOT USE THIS DIRECTLY. USE `sharedInstance` INSTEAD
	if (!(self = [super init])) {
        return nil; // Bail!
	}
    
    _handlerByOpaqueObject = [[NSMutableDictionary alloc] init];
		
    struct sockaddr zeroAddr;
    bzero(&zeroAddr, sizeof(zeroAddr));
    zeroAddr.sa_len = sizeof(zeroAddr);
    zeroAddr.sa_family = AF_INET;
    
    _reachabilityRef = SCNetworkReachabilityCreateWithAddress(NULL, (struct sockaddr *) &zeroAddr);
    
    [self startNotifier];
    
	return self;
}

- (void)dealloc {
    if (_reachabilityRef != NULL) {
        SCNetworkReachabilityUnscheduleFromRunLoop(_reachabilityRef, CFRunLoopGetCurrent(), kCFRunLoopCommonModes);
        CFRelease(_reachabilityRef);
    }    
}

#pragma mark - KVO

+ (NSSet *)keyPathsForValuesAffectingCurrentlyReachable {
    return [NSSet setWithObject:NPReachabilityKeys.currentReachabilityFlags];
}

+ (NSSet *)keyPathsForValuesAffectingCurrentNetworkStatus {
    return [NSSet setWithObject:NPReachabilityKeys.currentReachabilityFlags];
}

#pragma mark - Custom accessors

- (BOOL)isCurrentlyReachable {
	return [[self class] isReachableWithFlags:self.currentReachabilityFlags];
}

- (NPRNetworkStatus)currentNetworkStatus {
    NPRNetworkStatus currentStatus = NPRNotReachable;
    
    if (!([[self class] isReachableWithFlags:self.currentReachabilityFlags])) {
        // Nothing reachable
        return currentStatus;
    }
    
#if TARGET_OS_IPHONE
    if (_currentReachabilityFlags & kSCNetworkReachabilityFlagsIsWWAN) {
        // There is a connection, and it isn't Wi-Fi, so...
        return NPRReachableViaWWAN;
    }
#endif

    if (!(_currentReachabilityFlags & kSCNetworkReachabilityFlagsConnectionRequired)) {
		// if target host is reachable and no connection is required
		//  then we'll assume (for now) that you're on Wi-Fi
		return NPRReachableViaWiFi;
	}
        
    // If we get here, something else is going on. I'm going to be lazy and safe
    return currentStatus;
}

#pragma mark - Block handlers

- (id)addHandler:(ReachabilityHandler)handler {
	NSString *obj = [[NSProcessInfo processInfo] globallyUniqueString];
	[self.handlerByOpaqueObject setObject:[handler copy] forKey:obj];
	return obj;
}

- (void)removeHandler:(id)opaqueObject {
	[self.handlerByOpaqueObject removeObjectForKey:opaqueObject];
}

#pragma mark - Reachability

+ (BOOL)isReachableWithFlags:(SCNetworkReachabilityFlags)flags {
	
	if ((flags & kSCNetworkReachabilityFlagsReachable) == 0) {
		// if target host is not reachable
		return NO;
	}
	
	if ((flags & kSCNetworkReachabilityFlagsConnectionRequired) == 0) {
		// if target host is reachable and no connection is required
		//  then we'll assume (for now) that you're on Wi-Fi
		return YES;
	}
	
	
	if ((((flags & kSCNetworkReachabilityFlagsConnectionOnDemand ) != 0) ||
		 (flags & kSCNetworkReachabilityFlagsConnectionOnTraffic) != 0)) {
		// ... and the connection is on-demand (or on-traffic) if the
		//     calling application is using the CFSocketStream or higher APIs
		
		if ((flags & kSCNetworkReachabilityFlagsInterventionRequired) == 0) {
			// ... and no [user] intervention is needed
			return YES;
		}
	}
	
	return NO;
}

- (NSString *)reachabilityFlagsAsString {
    SCNetworkReachabilityFlags flags = self.currentReachabilityFlags;

    NSString *formatString;

#if TARGET_OS_IPHONE
    formatString = @"Reachability Flag Status: %c%c %c%c%c%c%c%c%c\n";
#else
    formatString = @"Reachability Flag Status: %c %c%c%c%c%c%c%c\n";
#endif

    NSString *debugString = [NSString stringWithFormat:formatString,
#if TARGET_OS_IPHONE
                             (flags & kSCNetworkReachabilityFlagsIsWWAN)			   ? 'W' : '-',
#endif
                             (flags & kSCNetworkReachabilityFlagsReachable)            ? 'R' : '-',

                             (flags & kSCNetworkReachabilityFlagsTransientConnection)  ? 't' : '-',
                             (flags & kSCNetworkReachabilityFlagsConnectionRequired)   ? 'c' : '-',
                             (flags & kSCNetworkReachabilityFlagsConnectionOnTraffic)  ? 'C' : '-',
                             (flags & kSCNetworkReachabilityFlagsInterventionRequired) ? 'i' : '-',
                             (flags & kSCNetworkReachabilityFlagsConnectionOnDemand)   ? 'D' : '-',
                             (flags & kSCNetworkReachabilityFlagsIsLocalAddress)       ? 'l' : '-',
                             (flags & kSCNetworkReachabilityFlagsIsDirect)             ? 'd' : '-'
                             ];

    return debugString;
}

#pragma mark - Private methods

- (NSArray *)handlers_ {
	return [self.handlerByOpaqueObject allValues];
}

- (void)startNotifier {
    SCNetworkReachabilityContext context = {0, (__bridge void *)(self), NULL, NULL, NULL};
    
    if (SCNetworkReachabilitySetCallback(_reachabilityRef, NPNetworkReachabilityCallBack, &context)) {
        SCNetworkReachabilityScheduleWithRunLoop(_reachabilityRef, CFRunLoopGetCurrent(), kCFRunLoopCommonModes);
    }
    SCNetworkReachabilityGetFlags(_reachabilityRef, &_currentReachabilityFlags);
}

void NPNetworkReachabilityCallBack(SCNetworkReachabilityRef target, SCNetworkReachabilityFlags flags, void *info) {
#pragma unused(target)
	NPReachability *reach = (__bridge NPReachability *)info;
    
    // NPReachability maintains its own copy of `flags` so that KVO works 
    // correctly. Note that `+keyPathsForValuesAffectingCurrentlyReachable`
    // ensures that this also fires KVO for the `currentlyReachable` property
    // and the `currentNetworkStatus` property.
    [reach setCurrentReachabilityFlags:flags];
    
	NSArray *allHandlers = [reach handlers_];
    
	for (ReachabilityHandler currHandler in allHandlers) {
		currHandler(reach);
	}
    
    // Post a notification - blocks are not always used.
    [[NSNotificationCenter defaultCenter] postNotificationName:NPReachabilityChangedNotification object:reach];
}


@end
