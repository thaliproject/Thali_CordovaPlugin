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
//  THEThreading.h
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
