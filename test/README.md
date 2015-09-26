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

In order to point the devices running test suites at the coordinating server a file, serveraddress.json, containing the 
ip address of the server host is installed in the jxcore folder of the test app. If the coordination server runs on
the same machine that you build the mobile apps on then everything will be set up for you. Otherwise you'll need to edit 
the serveraddress.json file yourself to make sure it contains the right server address.

On startup the test devices will connect back to the server to indicate their readiness to proceed. Once the required 
number of devices are ready the server will signal them to begin the first test. The server will then coordinate test 
execution so that each subsequent test is not commenced before all devices have finished the preceding one.

It is essential, therefore, that tests remain in a state which facilitates completion for the other devices in the test 
configuration before finally completing and tearing down it's resources.

## Usage

### Mobile

To run either unit or performance tests on mobile devices one first has to build a Cordova project and then launch
the Cordova project onto the phones. One also needs to run a coordination server.

We have a built in script available in Thali_CordovaPlugin/install that will create a sibling directory to 
Thali_CordovaPlugin called ThaliTest. This script can be run inside of Thali_CordovaPlugin/install by issuing
`jx npm run setupUnit` to create a Cordova project designed to run the unit tests and `jx npm run setupPerf`
to create a Cordova project designed to run the perf tests. This script will automatically generate a coordination
server config file for the current machine and put it into the Cordova project. It will also compile the Cordova
app for both iOS and Android. This therefore assumes that development is being done on a Mac.

Once either setupUnit or setupPerf is run make sure to:
1. Go to Thali_CordovaPlugin/test/TestServer and make sure that either Config_PerfTest.json or Config_UnitTest.json
is properly configured for the test you want to run.
2. Then run Thali_CordovaPlugin/test/TestServer/index.js to start the coordination server.

You can now deploy and run the tests on your two Android or two iPhone devices.

### Desktop

All of the tests are designed to be run on the desktop. Tests that require the ThaliEmitter (our mobile environment)
will de-activate themselves when run on the desktop. What is especially nice about running on the desktop is that
one can develop and debug directly in the Thali_CordovaPlugin directory. There is no need to do the kind of 
copying and pasting that Cordova development normally requires. Note that only the unit tests run on the desktop.
The perf tests are focused exclusively on measuring on the wire perf and so don't make sense (yet) on the desktop.

To set up your desktop environment for development go to Thali_CordovaPlugin/thali/install and run 
`sudo jx npm run setupDesktop`.

Sudo is needed because this script installs a symbolic link into your global NPM directory.

You can run all the tests by going to Thali_CordovaPlugin/test/www/jxcore and issuing `jx runTests.js`. But the
tests will happily run stand alone so you can run a test directly (e.g. `jx testConnectionTable.js`) thus allowing
you to easily run and debug individual tests.

### Writing Unit Tests
The Unit Tests are kept in Thali_CordovaPlugin/test/www/jxcore/bv_tests. So please put new tests there.

A test file will only be run if it starts with the letters 'test'.

Each test file must include:

```node
var tape = require('../lib/thali-tape');
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
