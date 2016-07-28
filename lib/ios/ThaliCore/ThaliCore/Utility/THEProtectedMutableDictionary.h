//
//  THEProtectedMutableDictionary.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <Foundation/Foundation.h>

// A thread-safe dictionary that allows common operations to be executed under lock 
@interface THEProtectedMutableDictionary : NSObject

// Execute |updateBlock| for |key|. The block will receive the current object.
// If the block returns a different object it will replace the original. 
// If the block returns nil the object will be removed (can't put nil in a dict
// anyway). If the key does not exist the block will receive nil.
- (void)updateForKey:(NSObject<NSCopying> *)key 
         updateBlock:(NSObject *(^)(NSObject *))updateBlock;

// Execute |updateBlock| for all dict values for which |filterBlock| returns true. 
// Iteration stops if the block returns NO
- (void)updateForFilter:(BOOL(^)(NSObject *))filterBlock 
                          updateBlock:(BOOL(^)(NSObject *))updateBlock;

@end
