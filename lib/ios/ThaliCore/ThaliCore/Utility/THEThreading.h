//
//  THEThreading.h
//  ThaliCore
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//

#ifndef THEThreading_h
#define THEThreading_h

#import <Foundation/Foundation.h>
#import <pthread.h>

// Executes the specified block on the main thread.
static inline void OnMainThread(dispatch_block_t block)
{
    // If this is the main thread, then just execute the block; otherwise, dispatch the block.
    if ([NSThread isMainThread])
    {
        block();
    }
    else
    {
        dispatch_async(dispatch_get_main_queue(), block);
    }
}

// Executes the specified block off the main thread.
static inline void OffMainThread(dispatch_block_t block)
{
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), block);
}

// Executes the specified block on the main thread after the specified delay.
static inline void OnMainThreadAfterTimeInterval(NSTimeInterval timeInterval, dispatch_block_t block)
{
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(timeInterval * NSEC_PER_SEC)), dispatch_get_main_queue(), block);
}

// Executes the specified block on the main thread after the specified delay.
static inline void OffMainThreadAfterTimeInterval(NSTimeInterval timeInterval, dispatch_block_t block)
{
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(timeInterval * NSEC_PER_SEC)), dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), block);
}

// Executes the specified block on the specified queue.
static inline void OnQueue(dispatch_queue_t queue, dispatch_block_t block)
{
    dispatch_async(queue, block);
}

// Executes the specified block on the specified queue.
static inline void OnQueueAfterTimeInterval(NSTimeInterval timeInterval, dispatch_queue_t queue, dispatch_block_t block)
{
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(timeInterval * NSEC_PER_SEC)), queue, block);
}

#endif
