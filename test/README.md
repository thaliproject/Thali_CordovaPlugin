# Tests for Thali

## Overview

The testing framework is split into two separate sets of tests:
- Unit tests
- Performance tests

Both types of test are managed by a coordinating server running on a Node capable device (usually a PC) on the same LAN (necessarily WiFi) as the devices under test.

The method of co-ordination differs slightly between the test types:

- With Unit tests the coordinating server simply syncronizes test setup and teardown across devices running the test suite. By this method we can ensure that devices are running the same test at the same time. Tests written to run under this regime should therefore assume they will run against themsselves running on a different device. 

- With performance tests the coordinating server additionally provides global options to devices running the test (e.g. number of times to run a particular test before collating results).

In order to point the devices running test suites at the coorinating server a file, serveraddress.json, containing the ip address of the server host is installed in the jxcore folder of the test app. You'll need to edit the file yourself to make sure it contains the right server address.

On startup the test devices will connect back to the server to indicate their readiness to proceed. Once the required number of devices are ready the server will signal them to begin the first test. The server will then coordinate test execution so that each subsequent test is not commenced before all devices have finished the preceding one.

It is essential, therefore, that tests remain in a state which facilitates completion for the other devices in the test configuration before finally completing and tearing down it's resources.

## Usage

Before running the test server you'll need to run 'npm install' in the www/jxcore directory within the test app in order to install the necessary node modules. This is a one-time operation unless you change the set of packages i.e. update package.json. 

Configuration for each test app is contained within the files Config\_Perftest.json and Config\_UnitTest.json which configure the performance and unit tests respectively.

Unit tests are found by scanning the 'tests' subdirectory for any file matchig the pattern test\*.

With performance tests the tests to be executed are specified in the config file.

## Running the Coordination Server

On a PC, from within the test/TestServer directory: node index.js. A side effect of starting the server is that the serveraddress.json file is created, ready to install into the test application.

## Building the Test App

- Follow instructions for creating a typical Thali app given [here](https://github.com/thaliproject/Thali_CordovaPlugin/blob/master/readme.md#getting-started) as far as step 5.

- Copy the test/www directory from the plugin source directory to the test app www directory i.e. from ThaliTest root do: 
  cp -R ../Thali\_CordovaPlugin/test/www .

Remember to copy the serveraddress.json config into the jxcore folder !!

## Running unit tests inside of the repro
It is possible to run the unit tests inside of the repo in order to allow for easy development and testing. To do
this one has to:

1. Go to Thali_CordovaPlugin/thali and issue `jx npm install` followed by `sudo jx npm link`.
2. Go to Thali_CordovaPlugin/test/www/jxcore and issue `jx npm link thali` followed by `jx npm install`
3. Go to Thali_CordovaPlugin/TestServer and issue `jx npm install`
4. While in Thali_CordovaPlugin/TestServer run `jx index.js`
5. Go to Thali_CordovaPlugin/www/jxcore and run `jx UnitTest_app.js`