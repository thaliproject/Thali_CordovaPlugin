# Tests for Thali

## Overview

The testing framework is split into two separate sets of tests:
- Unit tests
- Performance tests

The unit tests are themselves separated into two kinds of tests, ones that require mobile (because they exercise
local discovery and connectivity features) and those that run on mocks.

The mock based unit tests can all be run on the desktop, instructions for setting this up are given below.

The mobile based unit tests and the performance tests all require actual phones, at least two of the same type (e.g.
Android or iOS) in order to run. We also need a coordination server that can coordinate the tests across the testing
devices in order to make sure that the tests run consistently. This coordination server is typically run on a PC.

The coordination server talks to the devices over WiFi although in theory devices that support sharing network over
USB could also talk that way.

The method of co-ordination differs slightly between Unit and Performance tests:

- With Unit tests the coordinating server simply synchronizes test setup and teardown across devices running the test
suite. By this method we can ensure that devices are running the same test at the same time. Tests written to run
under this regime should therefore assume they will run against themsselves running on a different device.

- With performance tests the coordinating server additionally provides global options to devices running the test
(e.g. number of times to run a particular test before collating results).

In order to point the devices running test suites at the coordinating server a file, server-address.js, containing the
ip address of the server host is installed in the jxcore folder of the test app. If the coordination server runs on
the same machine that you build the mobile apps on then everything will be set up for you. Otherwise you'll need to edit
the server-address.js file yourself to make sure it contains the right server address.

On startup the test devices will connect back to the server to indicate their readiness to proceed. Once the required
number of devices are ready the server will signal them to begin the first test. The server will then coordinate test
execution so that each subsequent test is not commenced before all devices have finished the preceding one.

It is essential, therefore, that tests remain in a state which facilitates completion for the other devices in the test
configuration before finally completing and tearing down it's resources.

## Usage

### Installing software
To build Thali you need a fairly large collection of software. The most important
piece of software being Thali itself, so please start by cloning
https://github.com/thaliproject/thali_cordovaplugin/
to your machine.

In terms of operating system we assume you are running on macOS. In theory we can
run successfully on Linux or Windows but we really don't test there very often
so things are likely to break.

From there you need to install in macOS a fairly large mountain of software. For
now you can see the list [here](https://github.com/thaliproject/Thali_CordovaPlugin/blob/1df36b74ee93f1ece85579857ed90a0e05a0cdd1/thali/install/validateBuildEnvironment.js#L16).
You need to install the listed software at the listed version. Two of the entries
are about Sinopia. Details on that is in the next section.

### Running your own NPM registry
From time to time we run into bugs in PouchDB and Express-PouchDB that we can't
get fixed and into the public NPM repo fast enough to not block our development.
So we have written a script `installCustomPouchDB.js` that handles installing a
custom version of those packages if and when we need them. To make this work we
depend on the developer running a local copy of a program called sinopia
(although any private NPM repository server will do) and using that as a place
to stage our custom releases. This requires the following manual steps:

1. `npm install -g sinopia`. If you get errors, try to install via
`npm install -g sinopia --no-optional --no-shrinkwrap`
2. Run the `sinopia` command in a terminal window and leave it running, forever.
3. `npm set registry http://localhost:4873` or whatever the address of the
NPM registry server is.
4. `npm get registry`. There should be http://localhost:4873 or the other address from the previous point.
Otherwise run `npm set registry http://localhost:4873`
5. `npm adduser --registry http://localhost:4873` this last command will require
you to make up a name and password.

These steps really only have to be done once. Our code will detect the registry
and use it correctly.

### Mobile

To run either unit or performance tests on mobile devices one first has to build a Cordova project and then launch
the Cordova project onto the phones. One also needs to run a coordination server.

To run the mobile tests:

1. If you have a sibling directory to Thali_CordovaPlugin called ThaliTest, now would be a good time to delete it.
2. Go to `Thali_CordovaPlugin/thali/install`
3. Run `npm run setupUnit`. On Windows, run `./setUpTests.sh UnitTest_app.js`
or `./setupTests.sh PerfTest_app.js` on the latest Git Bash. The script will create a sibling directory to Thali_CordovaPlugin called
ThaliTest and will compile it for both Android and iOS. This assumes you are
running on a Mac with all the right tools.
4. Go to `Thali_CordovaPlugin/test/TestServer`.
5. Check out the default configuration options in test/TestServer/config/UnitTest.js
5. Run `jx index.js \{\"devices\":\{\"ios\":2,\"android\":2\}\}` in that directory on your local PC to start the
coordination server. Obviously edit the device counts passed on the command line to reflect the actual test
environment.
6. Deploy and run the tests on your two Android or two iPhone devices.

#### Hints on making native testing a bit easier

If you are manually running native tests it's typically because you are debugging something. Typically you are going to want to disable
all tests but those that you actually want to run. The changes below should be made in ThaliTest NOT in Thali_CordovaPlugin. You don't
want to check in these changes.

We have tests that are written in Java and are run from app.js via a command to Mobile('executeNativeTests'). If you don't care
about the Java tests for your debugging then that is the first thing to disable as those take a while to run and so will constantly slow
down your startup when doing another test run.

Next up you have to make sure you are running the kind of test you want to run. In UnitTest_app.js we set global.NETWORK_TYPE. When
running on desktop this gets overridden in all sorts of ways but not when we are on a device. So make sure the network type is what
you intend to actually test.

Then head over to ThaliTest/platform/android/assets/www/jxcore/bv_tests and either delete or move to a new folder any tests you don't
want to run. By default we only run files that start with the name 'test' and are children of the bv_tests folder.

One of the hardest tasks in debugging on Android is dealing with the logs. I've found that LogRabbit, a Mac OS program, is extremely
useful for this. Since one is typically debugging with multiple devices it is necessary to start up multiple instances of LogRabbit.
Chris Wilson, the developer of LogRabbit, showed how to do this, just issue the following on the command line:

```
$ /Applications/LogRabbit.app/Contents/MacOS/LogRabbit > /dev/null 2>&1 &
```

#### Testing Doze and App Standby on Android

Doze and App Standby are two new power-saving features introduced in Android 6.0 (API level 23).
For more information, see [Optimizing for Doze and App Standby](http://developer.android.com/training/monitoring-device-state/doze-standby.html).
To test how the Thali Cordova Plug-in copes with these modes on Android, follow the steps below:

1. Get [the modified Thali Native Test application](https://github.com/thaliproject/Thali_CordovaPlugin_BtLibrary/releases/tag/v0.2.8) for **device A**.
   This device does not have to be running Android 6.0 - Android 5.0+ (API level 21 or greater) is
   sufficient as long as the device support acting as a BLE peripheral (has BLE multiple advertisment
   support).
 * On the Settings tab of the application clear the peer name (set it empty) - this will utilize the
   simplified handshake message used by the Cordova Plug-in. You may need to restart the application
   in order for the setting to be applied.
2. Apply the following changes to [the `ConnectionHelper` class](https://github.com/thaliproject/Thali_CordovaPlugin/blob/vNext/src/android/java/io/jxcore/node/ConnectionHelper.java)
   of the Android project:
 * Use only one UUID ("b6a44ad1-d319-4b3a-815d-8b805a47fb51"):

    ```java
    private static final String SERVICE_UUID_AS_STRING = "b6a44ad1-d319-4b3a-815d-8b805a47fb51"; //"fa87c0d0-afac-11de-8a39-0800200c9a66";
    private static final String BLE_SERVICE_UUID_AS_STRING = "b6a44ad1-d319-4b3a-815d-8b805a47fb51";
    ```

 * Start `ConnectionManager` and `DiscoveryManager` explicitly in the constructor (on last line):

    ```java
    start(50000, true, new JXcoreThaliCallback() { });
    ```

  * Note that the server port (50000) is arbitrary and will not actually be used.
 * These changes can be added also to the generated and built Android application (after step 3).
3. Build the Thali Test app (in this project). See the instructions above (under **Mobile**).
4. Run the Thali Test app (the one you just generated/built with all the Cordova and JXcore stuff)
   on **device B** (this device has to run Android 6.0 or greater) and make sure you record its
   logcat logs. Recommended word for filtering the essential information from the log is "thali".
5. Active the Doze or the App Standby mode on **device B** using `adb` commands as explained [here](http://developer.android.com/training/monitoring-device-state/doze-standby.html#testing_doze_and_app_standby).
6. Use **device A** (the one running the Native Test application) to connect to **device B** and
   check the logs for results.
 * Note: You can only connect once after which the Thali Test app (on **device B**) needs to be
   restarted. This is because the Thali Test app will not be aware of disconnect events since it is
   running a dummy mode.

### Desktop

All of the test files are designed to be runnable also on the desktop. Tests that require the real mobile environment
will de-activate themselves when run on the desktop. What is especially nice about running on the desktop is that
one can develop and debug directly in the Thali_CordovaPlugin directory. There is no need to do the kind of
copying and pasting that Cordova development normally requires.

To set up your desktop environment for development go to
`Thali_CordovaPlugin/thali/install` and run `npm run setupDesktop`.

Sudo might be needed because this script installs a symbolic link into your global NPM directory. But if you can get
away without using it you will be much happier as using sudo for this (especially on macOS) seems to cause permission
nightmares.

You can run all the tests by going to Thali_CordovaPlugin/test/www/jxcore and issuing one of the following:

```
$ jx npm test
$ jx npm run test-meta
$ jx npm run test-coordinated
```

Some test files will also happily run stand-alone so you can run a test directly
(e.g. `jx runTests.js bv_tests/testTests.js`)
thus allowing you to easily run and debug individual tests.

To run only a single test, you can can edit the test sources to include `.only` in
the test definition, for example:

```
-test('basic', function (t) {
+test.only('basic', function (t) {
```

It is possible to run one test file (rather than just a single test) through the coordinator instead of
all of the files using `jx runCoordinatedTests.js --filter bv_tests/testThaliMobileNativeWrapper.js`.

It is also possible to debug one of the participants in a coordinated test by
starting the coordinated test from the command line but passing in the parameter
`--waitForInstance`. The coordinator will then start one less instance when
it runs with the assumption that one will then run `jx UnitTest_app.js` from
inside an IDE to debug.

By default tests are running with mocked android native API and with WiFi
network type. It is possible to change it via `--networkType=<wifi|both|native>`
and `--platform=<ios|android>` parameters, for example:

```
$ jx runCoordinatedTests.js --platform=ios --networkType=both
```

Also it is possible to run multiple coordinated tests simultaneously on the same
machine. Use `COORDINATED_PORT` environment variable to set different port for
each test runner, for example:

```
COORDINATED_PORT=12345 jx runCoordinatedTests.js --platform=ios &> ios.log & \
COORDINATED_PORT=54321 jx runCoordinatedTests.js --platform=android &> android.log &
```

This example will start iOS tests and android tests in parallel in background
and write entire output to the ios.log and android.log respectively.

### Writing Unit Tests
The Unit Tests are kept in Thali_CordovaPlugin/test/www/jxcore/bv_tests. So please put new tests there.

A test file will only be run if it starts with the letters 'test'.

Each test file must include:

```node
var tape = require('../lib/thaliTape');
```

Tests must also include a setup and tear down:

```node
var test = tape({
    setup: function(t) {
        ...
        t.end();
    },
    teardown: function(t) {
        ...
        t.end();
    }
});
```

Please keep in mind that when the tests are run on devices they are run via the coordination server. Each test
will automatically contact the coordination server, wait for the server to confirm that all expected devices
have contacted it and then tell the devices to start their tests. The test teardown will not run until all
devices have told the coordination server they are done. This is critical because most of the mobile tests involve
multiple devices talking to each other and we have to make sure that test servers and other infrastructure running
on each devices isn't destroyed in the teardown until everyone else has finished their tests.

Imagine we have a test that checks if replication is working. The test looks for how many devices are around and
tries to replicate with each of them. Let's say there are just 2 devices. In that case once device 1 has finished
checking replication with device 2 it could turn itself off and go to the next test. But device 2 might not have
finished checking replication with device 1. In that case device 2's test will fail because device 1 has already
called teardown, destroyed its test server and moved on. The coordination server prevents this. If device 1 finishes
its testing against device 2 before device 2 finishes testing against device 1 then the coordination server will
prevent device 1's teardown from running. This will leave up device 1's test server until device 2 finishes. When
device 2 finishes then it will signal the coordination server who will tell device 1 to tear down and move to the next
test.
