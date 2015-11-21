/*
 * This file needs to be renamed as app.js when we want to run performance tests
 * in order this to get loaded by the jxcore ready event.
 * This effectively acts as main entry point to the performance test app
*/

"use strict";

var testUtils = require("./lib/testUtils");
var fs = require('fs');
var parsedJSON = require('serveraddress.json');

testUtils.toggleRadios(true);

var CoordinatorConnector = require('./lib/CoordinatorConnector');
var TestFrameworkClient = require('./perf_tests/PerfTestFramework');

/*----------------------------------------------------------------------------------
 code for connecting to the coordinator server
 -----------------------------------------------------------------------------------*/

process.on('uncaughtException', function(err) {
    console.log("We have an uncaught exception, good bye: " + JSON.stringify(err));
    Coordinator.close();
});

process.on('unhandledRejection', function(err) {
    console.log("We have an uncaught promise rejection, good bye: " + JSON.stringify(err));
    Coordinator.close();
});

var bluetoothAddress = "";
var weHaveMadeInitialConnection= false;
var weHaveFinished = false;

var myName = "DEV" + Math.round((Math.random() * (10000)));
var Coordinator = new CoordinatorConnector();

if(jxcore.utils.OSInfo().isAndroid) {
    Mobile('GetBluetoothAddress').callNative(function (err, address) {
        if (err) {
            console.log("GetBluetoothAddress returned error: " + err + ", address : " + address);
            Coordinator.close();
            return;
        }


        bluetoothAddress = address;
        console.log("Got Device Bluetooth address: " + bluetoothAddress);
        Mobile('GetDeviceName').callNative(function (name) {

            myName = name + "_PT" + Math.round((Math.random() * (10000)));

            console.log('my name is : ' + myName);
            testUtils.setMyName(myName);

            //console.log('Connect to  address : ' + parsedJSON[0].address + ' type: ' + parsedJSON[0].name);
            Coordinator.init(parsedJSON[0].address, 3000);
            console.log('attempting to connect to test coordinator');


            //once we have had the BT off and we just turned it on,
            // we need to wait untill the BLE support is reported rigth way
            // seen with LG G4, Not seen with Motorola Nexus 6
            setTimeout(function () {
                Mobile('IsBLESupported').callNative(function (err) {
                    if (err) {
                        console.log("BLE advertisement not supported: " + err );
                        return;
                    }
                    console.log("BLE supported!!");
                });
            },5000);


            });
    });
}else{
    bluetoothAddress = "C0:FF:FF:EE:42:00";
    Mobile('GetDeviceName').callNative(function (name) {
        myName = name + "_PT" + Math.round((Math.random() * (10000)));
        ;
        console.log('my name is : ' + myName);
        testUtils.setMyName(myName);

        //console.log('Connect to  address : ' + parsedJSON[0].address + ' type: ' + parsedJSON[0].name);
        Coordinator.init(parsedJSON[0].address, 3000);
        console.log('attempting to connect to test coordinator');
    });
}

Coordinator.on('error', function (data) {

    //we have disconnected, thus lets not log any additional errors
    if(weHaveFinished){
        return;
    }

    var errData = JSON.parse(data);
    console.log('Error:' + data + ' : ' + errData.type +  ' : ' + errData.data);

    if(errData.type == "connect_error") {
        testUtils.printNetworkInfo();

        if(weHaveMadeInitialConnection){
            weHaveMadeInitialConnection = false;
            testUtils.reFreshWifi();
        }
    }
  testUtils.logMessageToScreen('Client error: ' + errData.type);
});

/*----------------------------------------------------------------------------------
 code for handling test communications
 -----------------------------------------------------------------------------------*/
var TestFramework = new TestFrameworkClient(myName);
TestFramework.on('done', function (data) {
  console.log('done, now sending data to server');
  Coordinator.sendData(data);
});

TestFramework.on('end', function (data) {
    console.log('end, event received');
    Coordinator.close();
});

TestFramework.on('debug', function (data) {
  testUtils.logMessageToScreen(data);
});

TestFramework.on('start_tests', function (data) {
    console.log('got start_tests event with data : ' + data);
});

Coordinator.on('too_late', function (data) {
    console.log('got too_late message');
    testUtils.logMessageToScreen("got too_late message");
    TestFramework.stopAllTests(false);

    Coordinator.close();
    //lets let the CI know that we did finish
    console.log("****TEST TOOK:  ms ****" );
    console.log("****TEST_LOGGER:[PROCESS_ON_EXIT_FAILED]****");
});

Coordinator.on('connect', function () {
    weHaveMadeInitialConnection = true;
    console.log('Coordinator is now connected to the server!');
    testUtils.logMessageToScreen('connected to server');
    Coordinator.present(myName,"perftest",bluetoothAddress);

    testUtils.printNetworkInfo();
});


Coordinator.on('command', function (data) {
    console.log('command received : ' + data);
    TestFramework.handleCommand(data);
});

Coordinator.on('closed', function () {
    if(weHaveFinished){
        return;
    }
    console.log('The Coordinator has closed!');
    //we need to stop & close any tests we are running here
     TestFramework.stopAllTests(false);
     testUtils.logMessageToScreen('fully-closed');
     console.log('turning Radios off');
     testUtils.toggleRadios(false);
     weHaveFinished = true;
});


Coordinator.on('disconnect', function () {
    console.log('The Coordinator has disconnected!');
});

// Log that the app.js file was loaded.
console.log('Test app app.js loaded');



