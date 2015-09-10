# Test Application for Thali

## current state

Currently the framework is considered finalized and performance tests are briefly tested to be working fine.

When using do remember that all devices & the machine where the coordinator server is run must be using same Wi-Fi network as well as you need to remember to copy the IP json file into the jxcore folder of the app.


## Plan

The original tests needs to be fixed to work with teh new framework, they are partially ported but will require some work to be completely implemented.

Then next step is to verify that tests are working fine, and also the reporting from the tests data needs to be improved.

## usage

Before running the test erver  do remember to use npm install to get the required nodejs modules installed. 

If additional modules are required, then there is package.json file present in the folder.

you also need to define test data with the config.json file.
- define with startDeviceCount on how many devices needs to be connected before tests are started
- add tests into the tests array, currently supported tests are "testFindPeers.js","testReConnect.js","testSendData.js","testThaliNativeLayer.js" and "testThaliEmitter.js"

Test item in the array includes the tests file name and:
- timeout: defines timeout value which after the coordinator server will cancel the test
- data: is data that gets sent to the clients devices, and defines what they need to do

The data with testThaliNativeLayer and testThaliEmitter only includes:
- timeout: defines timeout value which after the device will cancel the tests, and sent partial results back to the coordinator server

with testFindPeers additional data item included is:
- count: defines how many peers needs to be found/processed 

additionally with  re-Connect test data
- rounds defines how many rounds of connection established needs to be performed for each peers
- dataTimeout defines timeout which after data sent is determined to be lost, and the connection is disconnected (and reconnected, data send starts from the point we know we managed to deliver to other side)
- conReTryTimeout defines timeout value used between disconnection (by error) and re-connection 
- conReTryCount defined on how many times we re-try establishing connections before we give up.

also additionally with  send-data test data
- dataAmount defines the amount of data sent through each connection before disconnecting

## Coordinator server

Go to the folder where you have the index.js located and run it : node index.js

Check the console output for any possible errors reported

Make sure the ipaddress.json file is created. It should contain the IP-Address for the connected Wi-Fi network. 

## Phone Thali application

Create standard Thali app with the plugin: https://github.com/thaliproject/Thali_CordovaPlugin

Then add the content of the TestApp\www\ folder to the www folder  of the Thali app.

Do also remember to copy the ipaddress.json into the jxcore folder!