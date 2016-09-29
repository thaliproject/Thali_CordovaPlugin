# Configuring Tests for Coordinator server

## Overview

The testing framework comprises three basic elements:

- TestServer - Co-ordinates the actions of devices running instances of the test suite.
- Unit tests - Test suite designed to test functionality of individual units.
- Performance tests - All-up tests, designed to determine performance of the system as a whole.

The Test Server coordinates the actions of devices within the test environment running one of the test suites. Concurrent execution of two different test suites is not supported i.e. all the devices must be running the same test suite at the same time. Switching between different test suites is controlled by copying the appropriate test suite main entry point to app.js which is then loaded and executed on start-up by the devices under test.

The test server is invoked thus:

  node index.js '{"devices":{"ios":2,"android":19}}'

This is typically done by the CI system, the arguments being the number of devices of each platform that the CI system has succesfully deployed the test app to.

On startup each device will connect back to the test server (the ip addresss of which is distributed in the test package) and 'present' itself as ready to execute tests. At this time it will also declare which test suite it's currently running and which tests it is aware of being present in it's distribution.

Test execution proceeds according to the protocols defined by the subclasses of the TestFramework class, the Test Frameworks, provided in the TestServer directory.

Each test framework has it's own config in addition to the common test framework:

Unit Test Config
================

Contained in the file UnitTestConfig.js and exported directly as a module.

The follwing is a typical example:

```javascript
var config = {
  ios: {
    // Number of devices that must be presented before the test server will commence execution
    // -1 indicates 'all available devices', 0 means none (so that, for instance you can
    // test a single platform at a time).
    numDevices:2
  },
  android: {
    numDevices:2
  }
}

module.exports = config;
```

Unit Test execution proceeds one test at a time moving to the next test only when every device in the test has returned a result. Each test returns a pass or fail to the server. A unit test suite is cconsidered to have passed iff all tests on all devices within the suite returned a pass.


Perf Test Config
================

Contained within the file PerfTestConfig.js and exported directly as a module.

Here's example of the content of the PerfTestConfig.js:

```javascript
var config = {

  userConfig : {
    "ios" : {
      // The time (in ms) to wait before starting the test run regardless of how many devices
      // have been presented
      "startTimeout": 120000
    },
    "android" : { 
      "startTimeout": 120000
    }
  },
  
  testConfig : [
    {
      // Name of test file to be run
      "name": "testFindPeers.js",
      // Timeout (in ms) before the server will terminate the test run if not already complete
      "serverTimeout": 120000,
      // Timeout (in ms) before the test app itself will terminate if not already complete
      // Test apps *must* return data when timing out in this fashion
      "timeout": 100000,
      // DEPRECATED: Number of times the test will be run by the test app
      "rounds": 1,
      // Timeout (in ms) before the tests will declare an error if no data received.
      "dataTimeout": 10000,
      // Amount of data (in bytes) to be sent/received during the test run
      "dataAmount": 100000,
      // Timeout (in ms) before a connection attempt is abandoned and retried
      "conReTryTimeout": 5000,
      // Maximum number of times a connection will be retried before an error is declared
      "conReTryCount": 5
    },
    {
      "name": "testSendData.js",
      "serverTimeout": 120000,
      "timeout": 100000,
      "rounds": 1,
      "dataTimeout": 20000,
      "dataAmount": 100000,
      "conReTryTimeout": 5000,
      "conReTryCount": 5
    }
  ] 
};

module.exports = config;
```

There are two main sections:

userConfig
----------

Intended to be changed by the user as required during the test process and containing settings generally global to the entire test suite. There are as many different subsections as there are platforms currently installed (or not) in the test system.

testConfig
----------

A list of tests to be run. Tests may appear multiple times and are executed in the strict order in which they are declared. Values appearing here are test specific but many are found in all tests.

Test Completion
===============

As each test completes it will return results to the Test Server. Once all devices have returned results (or have timed out) the test server will instruct devices to move on to the next test.

 Below is example of the reply data item:

 ```json
 {"test": 0,
    "device": "LGE-Nexus 5_PT9763",
    "time": 18866,
    "data": {...}
 }
  ```

 ## The Perf Test Suite in detail
 
 ### testFindPeers
 
 testFindPeers test is used to determine how long does it take to find a peer, as well as whether we can find all available peers in given time.
 
 This test only requires one paramter, timeout, which is used to define suitable time which after the test is cancelled unless all peers have already been found.

Here's example data item for testFindPeers test.
```json
 "data": {"timeout": "20000"}
```
 
 Reply data for testFindPeers includes name of the device doing the test, time it took to run the test, ending result 'OK' indicating fully successfull test, 
 other values include for example 'TIMEOUT' indicating that the test was interrupted by timeout.
 
 The actual data is then included in the peersList array. The data itesm included are defined as follows:
 
 * peerName, name of the peer discovered
 * peerIdentifier, peer id of the peer discovered
 * peerAvailable, peerAvailability of the peer discovered (should always be true)
 * time it too to discover the peer (from start, or from last peer found)
  
 ```json
    "data": {
      "name:": "LGE-Nexus 5_PT9763",
      "time": 18643,
      "result": "OK",
      "peersList": [
        {
          "peerName": "LGE-Nexus 5_PT9757",
          "peerIdentifier": "CC:FA:00:52:DB:FD",
          "peerAvailable": true,
          "time": 7575
        },
        {
          "peerName": "LGE-Nexus 5_PT4587",
          "peerIdentifier": "CC:FA:00:71:F5:C6",
          "peerAvailable": true,
          "time": 18623
        }
      ]
    }
 ```
 
### testReConnect
 
 testReConnect test is used to measure how long does it take to create a connection and sent small amount (100 bytes) of data to the peer, as well as whether we can connect to all peers available.
 
This test requires several parameters:

* timeout, which is used to define a suitable time which after the test is cancelled unless all peers have already been connected successfully.
* round, optional values defining how many connections we should do in one test (recommended to use 1, since if any round is markd as failed, the peer test is marked as failed)
* dataTimeout, resonable timeout value in which the data should be transfered between peer, if reached will close the  connection and mark the test round failed
* conReTryTimeout, timeout value used before any connect (so when connections are failing etc. we wont be trying connections too frequently)
* conReTryCount, we can define with this value whether the failed connection attempts should be re-tried and how many times we would try before marking the round failed
 
 ```json
 "data": {"timeout": "60000","rounds":"1","dataTimeout":"5000","conReTryTimeout":"2000","conReTryCount":"1"} 
 ```
 
  Reply data for testReConnect includes name of the device doing the test, time it took to run the test, ending result 'OK' indicating fully successfull test, 
 other values include for example 'TIMEOUT' indicating that the test was interrupted by timeout.
 
 The actual data is then included in the connectList array. The data itesm included are defined as follows:
 
 * name, name / address  to which connection was attempted for
 * time, time it too to create the connection and to sent the small amount of data
 * result, value 'OK' indicates successfull connection & data sending, other values are indicating failed test
 * connections, number of tries untill we got successfull test (requires the values of re-tries to be more than 1)
 * tryCount, indicates how many times we tried the test for this device. If larger than 1, then we had failed tries with this peer before we got successfull completion
 
 ```json
 "data": {
      "name:": "LGE-Nexus 5_PT9763",
      "time": 24615,
      "result": "OK",
      "connectList": [
        {
          "name": "CC:FA:00:52:DB:FD",
          "time": 1626,
          "result": "OK",
          "connections": 1,
          "tryCount": 1
        },
        {
          "name": "CC:FA:00:71:F5:C6",
          "time": 11732,
          "result": "OK",
          "connections": 1,
          "tryCount": 2
        }
      ]
    }
  ```
 
### testSendData
 
 testSendData is used to measure how long does it take to send a specified amount of data to other peer, as well as whether we can send data to all peers available.
 
 This test requires several parameters:

* timeout, which is used to define a suitable time which after the test is cancelled unless all peers have already been connected successfully.
* round, optional values defining how many connections we should do in one test (recommended to use 1, since if any round is markd as failed, the peer test is marked as failed)
* dataAmount, amount of data in bytes to be send in each test.
* dataTimeout, resonable timeout value in which 10000 bytes should be transfered to other peer, if reached will do re-try if conReTryCount defines so.
* conReTryTimeout, timeout value used before any connect (so when connections are failing etc. we wont be trying connections too frequently)
* conReTryCount, we can define with this value whether the failed connection attempts should be re-tried and how many times we would try before marking the round failed. Note: Data timeout will also cause re-try
 
 
 ```json
 "data": {"timeout": "6000000","rounds":"1","dataAmount":"1000000","dataTimeout":"10000","conReTryTimeout":"2000","conReTryCount":"5"}
 ```
 
   Reply data for testReConnect includes name of the device doing the test, time it took to run the test, ending result 'OK' indicating fully successfull test, 
 other values include for example 'TIMEOUT' indicating that the test was interrupted by timeout.
 
 The actual data is then included in the connectList array. The data itesm included are defined as follows:
 
 * name, name / address  to which connection was attempted for
 * time, time it too to create the connection and to sent the specified amount of data
 * result, value 'OK' indicates successfull connection & data sending, other values are indicating failed test
 * connections, number of tries untill we got successfull test (requires the values of re-tries to be more than 1)
 * tryCount, indicates how many times we tried the test for this device. If larger than 1, then we had failed tries with this peer before we got successfull completion
 
 
  ```json
 "data": {
      "name:": "LGE-Nexus 5_PT9763",
      "time": 113121,
      "result": "OK",
      "sendList": [
        {
          "name": "CC:FA:00:52:DB:FD",
          "time": 59171,
          "result": "OK",
          "connections": 1
		  "tryCount": 1
        },
        {
          "name": "CC:FA:00:71:F5:C6",
          "time": 53878,
          "result": "OK",
          "connections": 1
		  "tryCount": 2
        }
      ]
    }
  ```
  
 ## test report
 
 The test report is first printing out results by each device, and in the end also combined results of all devices.
 
 If the results are from different types of test, then the order of results to be printed is : testFindPeers, testReConnect and testSendData.
 
 The first line  identifies the number of results, and the smallest & biggest values measured.
 Second line shows values for 100, 99, 95, & 90 persentage points from the measured values.
 
 With testReConnect and testSendData between these lines there are also additional information printed.
 the Failed connections indicates the number of peers the tests failed with, and the Never tried indicates how many peers we did not even get to try before we got timeout.

 Here's example of a test report:
 
--------------- test report ---------------------
--------------- LGE-Nexus 5_PT2258 --------------------- : 1
LGE-Nexus 5_PT2258 has 2 peersList result, range 8067 ms  to  18142 ms.
100% : 18142 ms, 99% : 18142 ms, 95 %: 18142 ms, 90% : 18142 ms.
LGE-Nexus 5_PT2258 has 2 connectList result , range 3422 ms to  5495 ms.
Failed connections 0(0%)
Never tried (test timeout) connections 0(0%) of all
100% : 5495 ms, 99% : 5495 ms, 95% : 5495 ms, 90% : 5495 ms.
LGE-Nexus 5_PT2258 has 2 sendList result , range 67412 ms to  83767 ms.
Failed connections 0(0%)
Never tried (test timeout) connections 0(0%)
100% : 83767 ms, 99% : 83767 ms, 95 : 83767 ms, 90% : 83767 ms.
--------------- LGE-Nexus 5_PT5224 --------------------- : 2
LGE-Nexus 5_PT5224 has 2 peersList result, range 9264 ms  to  10826 ms.
100% : 10826 ms, 99% : 10826 ms, 95 %: 10826 ms, 90% : 10826 ms.
LGE-Nexus 5_PT5224 has 2 connectList result , range 1054 ms to  1088 ms.
Failed connections 0(0%)
Never tried (test timeout) connections 0(0%) of all
100% : 1088 ms, 99% : 1088 ms, 95% : 1088 ms, 90% : 1088 ms.
LGE-Nexus 5_PT5224 has 2 sendList result , range 63324 ms to  89963 ms.
Failed connections 0(0%)
Never tried (test timeout) connections 0(0%)
100% : 89963 ms, 99% : 89963 ms, 95 : 89963 ms, 90% : 89963 ms.
--------------- LGE-Nexus 5_PT3151 --------------------- : 3
LGE-Nexus 5_PT3151 has 2 peersList result, range 9587 ms  to  11305 ms.
100% : 11305 ms, 99% : 11305 ms, 95 %: 11305 ms, 90% : 11305 ms.
LGE-Nexus 5_PT3151 has 2 connectList result , range 656 ms to  5388 ms.
Failed connections 0(0%)
Never tried (test timeout) connections 0(0%) of all
100% : 5388 ms, 99% : 5388 ms, 95% : 5388 ms, 90% : 5388 ms.
LGE-Nexus 5_PT3151 has 2 sendList result , range 38747 ms to  70922 ms.
Failed connections 0(0%)
Never tried (test timeout) connections 0(0%)
100% : 70922 ms, 99% : 70922 ms, 95 : 70922 ms, 90% : 70922 ms.
--------------- Combined ---------------------
peersList : 100% : 18142 ms, 99% : 18142 ms, 95 : 18142 ms, 90% : 11305 ms.
connectList : 100% : 5495 ms, 99% : 5495 ms, 95 : 5495 ms, 90% : 5388 ms.
sendList : 100% : 89963 ms, 99% : 89963 ms, 95 : 89963 ms, 90% : 83767 ms.
--------------- end of test report ---------------------
 
 
 
 
 
