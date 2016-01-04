# Configuring Tests for Coordinator server

## Overview

The testing framework is split into two separate sets of tests:
- Unit tests
- Performance tests

With unit test during the initialization of the test, the the coordinator server is given the number of devices included in the test, and after this the
coordinator server is simply timing the start & teardown of the tests for the connected devices. and to achieve this its simply counting the events for each statr & stop,
and once the count reaches the number of devices included in the test, then it will command the unit tests to continue.

With Performance tests the coordinator server is used to control the test start & stop event as well as its used to give test parameters to the devices.
These parameters are send for each test when it is started, and each test-type defined which parameters it will use during the test.

Test and the parameters are defined in the Config_PerfTest.json file located in the root directory. The json file must include array of tests, and each test must include
name, servertimeout and data values. name must be the filename of one the defined tests (testFindPeers.js/testReConnect.js/testSendData.js), servertimeout should be some reasonable value 
defining on when the test should be timed out (if the test has not send the result data before it), and data item must include all required parameters for the defined test

Here's example of the content of the Config_PerfTest.json file file

```json
[
  {
    "name": "testSendData.js",
    "serverTimeout": 1200000,
    "timeout": 1000000,
    "rounds": 3,
    "dataTimeout": 20000,
    "dataAmount": 100000,
    "conReTryTimeout": 5000,
    "conReTryCount": 5
  },

  {
    "name": "testFindPeers.js",
    "serverTimeout": 1200000,
    "timeout": 1000000,
    "rounds": 1,
    "dataTimeout": 10000,
    "dataAmount": 100000,
    "conReTryTimeout": 5000,
    "conReTryCount": 5
  },

  {
    "name": "testReConnect.js",
    "serverTimeout": 1200000,
    "timeout": 1000000,
    "rounds": 1,
    "dataTimeout": 10000,
    "dataAmount": 100000,
    "conReTryTimeout": 5000,
    "conReTryCount": 5
  }
] 
```
 
 The reply data item includes test number, device name from which is result is from, time it took to do the whole test, and then test specific data values.  
 
 Below is example of the reply data item:

 ```json
 {"test": 0,
    "device": "LGE-Nexus 5_PT9763",
    "time": 18866,
    "data": {...}
 }
  ```

 ## Content of the Config_PerfTest.json
 
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
 
 
 
 
 
