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
//  THEProtectedMutableDictionary.m
//

#import <pthread.h>
#import "THEProtectedMutableDictionary.h"

@implementation THEProtectedMutableDictionary
{
    pthread_mutex_t _mutex;
    NSMutableDictionary * _dict;
}

- (instancetype)init
{
    self = [super init];
    if (!self)
    {
        return nil;
    }
 
    _dict = [[NSMutableDictionary alloc] init];

    return self;
}

- (void)createWithKey:(NSObject<NSCopying> *)key createBlock:(NSObject *(^)(NSObject *))createBlock
{
    pthread_mutex_lock(&_mutex);

    NSObject *newObject = createBlock(_dict[key]);
    if (newObject)
    {
        _dict[key] = newObject;
    }

    pthread_mutex_unlock(&_mutex);
}

- (void)updateWithKey:(NSObject<NSCopying> *)key updateBlock:(void(^)(NSObject *))updateBlock
{
    pthread_mutex_lock(&_mutex);

    updateBlock(_dict[key]);
    
    pthread_mutex_unlock(&_mutex);
}

- (void)updateWithFilter:(BOOL(^)(NSObject *))filterBlock updateBlock:(BOOL(^)(NSObject *))updateBlock
{
    pthread_mutex_lock(&_mutex);

    for (id key in _dict)
    {
        NSObject *value = _dict[key];
        if (filterBlock(value))
        {
            if (!updateBlock(value))
            {
                break;
            }
        }
    }

    pthread_mutex_unlock(&_mutex);
}

@end
