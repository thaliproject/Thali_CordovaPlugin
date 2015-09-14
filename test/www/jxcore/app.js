
"use strict";

var test = require('tape');
var express = require('express');
var net = require('net');

var app = express();
app.disable('x-powered-by');

var server = net.createServer(function (socket) {
    socket.pipe(socket);
});

var myName = "UNIT-TEST";


app.listen(5000, function () {
    server.listen(5001, function () {
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
                }
            })
            .on('end', function () {
                // Log final results
                logMessageToScreen("------ Final results ---- ");
                logMessageToScreen('Total: ' + total + ', Passed: ' + passed + ', Failed: ' + failed);
                console.log('Total: %d\tPassed: %d\tFailed: %d', total, passed, failed);

                console.log("Remaining a server...");
                var ThaliEmitter = require('thali/thaliemitter');
                var e = new ThaliEmitter();
                e.startBroadcasting((+ new Date()).toString(), 5001, function (err) {
                    if (err) {
                        console.log("Failed to remain a server");
                    }
                });

            });

        require('./runTests.js');
    });
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
