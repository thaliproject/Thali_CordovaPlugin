/*
 * This file needs to be renamed as app.js when we want to run unit tests
 * in order this to get loaded by the jxcore ready event.
 * This effectively acts as main entry point to the unit test app
 */

"use strict";

var test = require('tape');
//var express = require('express');
var net = require('net');
var testUtils = require("./lib/testUtils");

testUtils.toggleRadios(true);

//var app = express();
//app.disable('x-powered-by');

var myName = "UNIT-TEST";
testUtils.setMyName(myName);

//app.listen(5000, function () {

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

        testUtils.logMessageToScreen(row.id + ' isOK: ' + row.ok + ' : ' + row.name);

        if(row.ok && row.name) {
            if(!row.ok){
                failedRows.push(row);
            }
        }
    })
    .on('end', function () {
        // Log final results
        testUtils.logMessageToScreen("------ Final results ---- ");

        for(var i = 0; i < failedRows.length; i++){
            testUtils.logMessageToScreen(failedRows[i].id + ' isOK: ' + failedRows[i].ok + ' : ' + failedRows[i].name);
        }

        testUtils.logMessageToScreen('Total: ' + total + ', Passed: ' + passed + ', Failed: ' + failed);
        console.log('Total: %d\tPassed: %d\tFailed: %d', total, passed, failed);
        testUtils.toggleRadios(false);

        console.log("****TEST TOOK:  ms ****" );
        console.log("****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****");
    });

  require('./runTests.js');
//});

// Log that the app.js file was loaded.
console.log('Test app app.js loaded');
