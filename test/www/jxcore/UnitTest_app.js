/**
 * This file needs to be renamed as app.js when we want to run unit tests
 * in order this to get loaded by the jxcore ready event.
 * This efectively acts as main entry poin to the unit test app
 */

"use strict";

var test = require('tape');
var express = require('express');
var net = require('net');

var app = express();
app.disable('x-powered-by');

var myName = "UNIT-TEST";

app.listen(5000, function () {

  var failedRows = [];
  var rows = [], total = 0, passed = 0, failed = 0;

  test.createStream({ objectMode: true })
    .on('data', function (row) {
        // Log for results
        console.log(JSON.stringify(row));

        if (row.type === 'assert') {
            total++;
            row.ok && passed++;
            !row.ok && failed++;
        }
        rows.push(row);

        //lets just show only results, not setup, teardown etc. rows.
        if(row.ok && row.name) {
            logMessageToScreen(row.id + ' isOK: ' + row.ok + ' : ' + row.name);

            if(!row.ok){
                failedRows.push(row);
            }
        }
    })
    .on('end', function () {
        // Log final results
        logMessageToScreen("------ Final results ---- ");

        for(var i = 0; i < failedRows.length; i++){
            logMessageToScreen(failedRows[i].id + ' isOK: ' + failedRows[i].ok + ' : ' + failedRows[i].name);
        }

        logMessageToScreen('Total: ' + total + ', Passed: ' + passed + ', Failed: ' + failed);
        console.log('Total: %d\tPassed: %d\tFailed: %d', total, passed, failed);
    });

  require('./runTests.js');
});

/***************************************************************************************
 functions for Cordova side application, used for showing debug logs
 ***************************************************************************************/

function isFunction(functionToCheck) {
    var getType = {};
    return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}

var LogCallback;

function logMessageToScreen(message) {
    if (isFunction(LogCallback)) {
        LogCallback(message);
    } else {
        console.log("LogCallback not set !!!!");
    }
}

Mobile('setLogCallback').registerAsync(function (callback) {
    LogCallback = callback;
});

Mobile('getMyName').registerAsync(function (callback) {
    callback(myName);
});

// Log that the app.js file was loaded.
console.log('Test app app.js loaded');
