#NPReachability
- Originally By [Nick Paulson](http://twitter.com/nckplsn)
- KVO support added by [Adam Ernst](http://www.adamernst.com/)
- ARC support and changes to the interface by [Abizer Nasir](http://abizern.org)

NPReachability is an evolution of Apple's Reachability class that provides
information about the network status.

As well as supporting the original's Notification based monitoring, this class
supports both KVO and Blocks, so you can choose whichever way of handling
changes as your application requires.

This class is written as a singleton, so be sure to reference it as

NPReachability *reachability = [NPReachability sharedInstance];

Make sure you maintain a strong reference to at least one object of this class
or else ARC will clean it up underneach you.
 
## Block support

Handlers are declared as

    typedef void (^ReachabilityHandler)(NPReachability *curReach);

This takes the NPReachability object as a parameter. As originally written
this class passed the `SCNetworkReachabilityFlags` as a parameter, but you can
get that and more by messaging the object directly

You add blocks to be executed when the network status changes by using:

    - (id)addHandler:(ReachabilityHandler)handler;

This returns an opaque object which you should use to remove the handler at the
appropriate time (in a `dealloc`, say) with:

    - (void)removeHandler:(id)opaqueObject;

## KVO support

Two properties can observed for changes to the network status:

    @property (nonatomic, readonly, getter=isCurrentlyReachable) BOOL currentlyReachable;
	@property (nonatomic, readonly) SCNetworkReachabilityFlags currentReachabilityFlags;

## NSNotification

When the network status changes a `NPReachabilityChangedNotification` is sent
with the NPReachability instance as the notification object.

## Dependencies

- Xcode 5.0+ for ARC support, automatic synthesis and compatibility
  libraries. This might work for Xcode 4.2+, but I haven't been able to test it.
- The SystemConfiguration Framework should be added to your project.

## Usage

### Git

Add the project as a submodule to your project's repository and add the
`NPReachability.h` and `NPReachability.m` files to your project.

### CocoaPods

This is also available as a CocoaPod. If you're a Podder, then you already know
what to do to add this to your project.

### Direct files

Just add the `NPReachability.h` and `NPReachability.m` files to your
project. But I think the other any of the previous two methods is preferable to
this.

## Example

Apple provided the Reachability Sample Code to demonstrate the use of their
`Reachability` class. To see how to use this Class instead have a look at
[NPReachability-Example](https://github.com/Abizern/NPReachability-Example)
which shows the same project using `NPReachability` instead.

## And finally...

Please use and improve! Patched accepted, or create an issue.

I'd love it if you could send me a note as to which app you're using it with!
