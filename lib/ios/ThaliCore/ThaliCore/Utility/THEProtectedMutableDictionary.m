//
//  THEProtectedMutableDictionary.m
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#import <pthread.h>
#import "THEProtectedMutableDictionary.h"

@interface THEProtectedMutableDictionary()
{
  NSMutableDictionary * _dict;
}
@end

@implementation THEProtectedMutableDictionary
{
  pthread_mutex_t _mutex;
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

- (void)updateForKey:(NSObject<NSCopying> *)key updateBlock:(NSObject *(^)(NSObject *))updateBlock
{
  // Can't have nil keys
  if (key == nil)
    return;

  pthread_mutex_lock(&_mutex);
  
  NSObject *newObject = updateBlock(_dict[key]);
  if (newObject == nil)
  {
    [_dict removeObjectForKey:key];
  }
  else if (newObject != _dict[key])
  {
    if (newObject)
    {
      _dict[key] = newObject;
    }
  }

  pthread_mutex_unlock(&_mutex);
}

- (void)updateForFilter:(BOOL(^)(NSObject *))filterBlock 
                          updateBlock:(BOOL(^)(NSObject *))updateBlock
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
