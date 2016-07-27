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
//  THEProtectedMutableDictionary.h
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
