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
//  ThaliMobile
//  THEThaliCore.m
//

#import "THEThaliCore.h"
#import <Cordova/CDV.h>
#import "THEAppContext.h"
#include "jx.h"

JXValue * javaScriptFunction1;
JXValue * javaScriptFunction2;

void registerJavaScriptFunction1(JXValue *params, int argc)
{
    NSLog(@"registerJavaScriptFunction1 called.");

    assert(JX_IsFunction(params));
    javaScriptFunction1 = params;
    JX_MakePersistent(javaScriptFunction1);
    
}

void registerJavaScriptFunction2(JXValue *params, int argc)
{
    NSLog(@"registerJavaScriptFunction1 called.");

    assert(JX_IsFunction(params));
    javaScriptFunction2 = params;
    JX_MakePersistent(javaScriptFunction2);
}

void nativeFunction1(JXResult * results, int argc)
{
    NSLog(@"&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
    NSLog(@"nativeFunction1 called. Arg count is %i", argc);
    NSLog(@"&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
    
    JXValue ret_val;
    JX_CallFunction(javaScriptFunction1, NULL, 0, &ret_val);
}

void nativeFunction2(JXResult * results, int argc)
{
    if (argc != 1)
    {
        NSLog(@"Error. Wrong number of arguments.");
        return;
    }
    if (!JX_IsString(results + 0))
    {
        NSLog(@"Error. Argument 1 is not a string.");
        return;
    }
    
    char * arg = JX_GetString(results + 0);
    
    NSString * argString = [NSString stringWithFormat:@"%s", arg];
    
    
    NSLog(@"&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
    NSLog(@"NativeFunction2 called. Arg is '%@'", argString);
    NSLog(@"&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
    
    JXValue params[1];
    JX_New(&params[0]);
    JX_SetString(&params[0], "Native calling", 15);
    
    JXValue ret_val;
    JX_CallFunction(javaScriptFunction2, params, 1, &ret_val);
}

// THEThaliCore (Internal) interface.
@interface THEThaliCore (Internal)
@end

// THEThaliCore implementation.
@implementation THEThaliCore
{
@private
}

// Class initializer.
- (CDVPlugin*)initWithWebView:(UIWebView *)theWebView
{
    // Initialize superclass.
    self = [super initWithWebView:theWebView];
    
    // Handle errors.
    if (!self)
    {
        return nil;
    }
    
    // Initialize.
    
    return self;
}

// Define extensions.
- (void)defineExtensions
{
//    // Call the base class method.
//    [super defineExtensions];
    
    // Define native methods extensions.
    JX_DefineExtension("registerJavaScriptFunction1", registerJavaScriptFunction1);
    JX_DefineExtension("registerJavaScriptFunction2", registerJavaScriptFunction2);
    JX_DefineExtension("nativeFunction1", nativeFunction1);
    JX_DefineExtension("nativeFunction2", nativeFunction2);
}

@end

// THEThaliCore (Internal) implementation.
@implementation THEThaliCore (Internal)
@end
