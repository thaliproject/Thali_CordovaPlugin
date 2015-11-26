/*
 * This file needs to be renamed as app.js when we want to run unit tests
 * in order this to get loaded by the jxcore ready event.
 * This effectively acts as main entry point to the unit test app
 */

"use strict";

var net = require('net');
var test = require('tape');
var testUtils = require("./lib/testUtils");

testUtils.toggleRadios(true);

var myName = "UNIT-TEST";
testUtils.setMyName(myName);

require('./runTests.js');
console.log('Test app app.js loaded');
