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

var failedRows = [];
var rows = [], total = 0, passed = 0, failed = 0;
/*
*/
require('./runTests.js');

// Log that the app.js file was loaded.
console.log('Test app app.js loaded');
