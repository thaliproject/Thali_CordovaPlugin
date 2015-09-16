# Tests for Thali

## Overview

The testing frmework is split into two separate sets of tests:
- Unit tests
- Performance tests

Both tests are controlled by centran coordinating server, but the test are managed between the tests in different manner.

With Unit tests, the coordinator server is simply used to syncronize test setup and test teardown between devices running the test.

And with performance tests the coordinator server is used as test manager, which is commanding devices to run specific tests with specific arguments. Additionally the test server also syncronizes the test teardown.

When running the tests, do remember that all devices in which the tests are run, as well as the computer in which the the coordinator server is run must be using same Wi-Fi network.

Addtionally you also need to remember to make sure that the serveraddress.json file is copied into the jxcore folder of the test app.

## usage

Before running the test server  do remember to use npm install to get the required nodejs modules installed. 

Do also remember to spcify at least the count of device in the test with Config_PerfTest.json and Config_UnitTest.json files.

With performance tests, you should also check that the required tests are defined in the tests array, as well as that corresponding tests are included in the application.

## Coordinator server

Go to the folder where you have the index.js located and run it : node index.js

Check the console output for any possible errors reported

Make sure the serveraddress.json file is created. It should contain the IP-Address for the connected Wi-Fi network. 

## Phone application

Create standard Thali app with the plugin: https://github.com/thaliproject/Thali_CordovaPlugin

Then add the content of the TestApp\www\ folder to the www folder  of the Thali app.

Do also remember to copy the serveraddress.json into the jxcore folder!