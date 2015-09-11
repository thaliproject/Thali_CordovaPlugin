'use strict';

var events = require('events');

var originalMobile = typeof Mobile === "undefined" ? undefined : Mobile;
var mockMobile = require('../mockmobile');
var ThaliEmitter = require('thali/thaliemitter');
var tape = require('wrapping-tape');

function noop () { }

function testThaliEmitter(jsonData,name) {
  var self = this;
  this.name = name;
  this.commandData = JSON.parse(jsonData);
  this.startTime = new Date();
  this.endTime = new Date();
  this.endReason = "";
  this.testResults = [];
  self.currentTest = null;

  this.test = tape({
    setup: function(t) {
      console.log('SETUP now');
      global.Mobile = mockMobile;
      self.currentTest = null;
      t.end();
    },
    teardown: function(t) {
      console.log('TEARDOWN now');
      global.Mobile = originalMobile;
      self.currentTest = null;
      self.currentTestNo++;
      self.doNextTest(self.currentTestNo);
      t.end();
    }
  });

  console.log('testThaliEmitter is created');
}

testThaliEmitter.prototype = new events.EventEmitter;

testThaliEmitter.prototype.start = function() {
  var self = this;
  this.startTime = new Date();

  if (this.commandData.timeout) {
    this.timerId = setTimeout(function () {
      console.log('timeout now');
      if (!self.doneAlready) {
        console.log('TIMEOUT');
        self.endReason = "TIMEOUT";
        self.emit('debug', "*** TIMEOUT ***");
        self.stop(true);
      }
    }, this.commandData.timeout);
  }

  this.currentTestNo = 1;
  this.doNextTest(this.currentTestNo);
}

testThaliEmitter.prototype.stop = function(doReport) {
  console.log('testThaliNativeLayer::stop');

  if (this.timerId != null) {
    clearTimeout(this.timerId);
    this.timerId = null;
  }

  if(doReport) {
    this.weAreDoneNow();
  }
  this.doneAlready = true;

  if(this.currentTest != null) {
    this.currentTest.fail('stop was called while doing the test');
    this.currentTest = null;
  }
}

testThaliEmitter.prototype.doNextTest = function(testNo) {

  if(this.doneAlready) {
    return;
  }

  console.log('do next test : ' + testNo);
  switch(testNo) {
    case 1:
      this.doTest1();
      break;
    case 2:
      this.doTest2();
      break;
    case 3:
      this.doTest3();
      break;
    case 4:
      this.doTest4();
      break;
    case 5:
      this.doTest5();
      break;
    case 6:
      this.doTest6();
      break;
    case 7:
      this.doTest7();
      break;
    case 8:
      this.doTest8();
      break;
    case 9:
      this.doTest9();
      break;
    case 10:
      this.doTest10();
      break;
    case 11:
      this.doTest11();
      break;
    case 12:
      this.doTest12();
      break;
    case 13:
      this.doTest13();
      break;
    case 14:
      this.doTest14();
      break;
    case 15:
      this.doTest15();
      break;
    case 16:
      this.doTest16();
      break;
    default:
      this.endReason = "OK";
      this.stop(true);
      break;
  }
}

testThaliEmitter.prototype.doTest1 = function() {
  var self = this;
  self.emit('debug', "1. peerAvailabilityChanged registered");

  console.log('DEBUG 1');

  self.test('#init should register the peerAvailabilityChanged event', function (t) {
    self.currentTest = t;
    var emitter = new ThaliEmitter();
    console.log('DEBUG 2');

    emitter.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, function (data) {
      console.log('DEBUG 4 ' + data );
      t.equal(data[0].peerIdentifier, '12345');
      t.equal(data[0].peerName, 'foo');
      t.equal(data[0].peerAvailable, true);
      t.end();
    });
    console.log('DEBUG 3');

    Mobile.invokeNative(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, [{
      peerIdentifier: '12345',
      peerName: 'foo',
      peerAvailable: true
    }]);
  });
}

testThaliEmitter.prototype.doTest2 = function() {
  var self = this;
  self.emit('debug', "2. networkChanged registered");
  self.test('#init should register the networkChanged event', function (t) {
    self.currentTest = t;
    var emitter = new ThaliEmitter();

    emitter.on(ThaliEmitter.events.NETWORK_CHANGED, function (status) {
      t.equal(status.isAvailable, true);
      t.end();
    });

    Mobile.invokeNative(ThaliEmitter.events.NETWORK_CHANGED, {
      isAvailable: true
    });
  });
}

testThaliEmitter.prototype.doTest3 = function() {
  var self = this;
  self.emit('debug', "3.throw on null device name");
  self.test('#startBroadcasting should throw on null device name', function (t) {
    self.currentTest = t;
    var emitter = new ThaliEmitter();

    var deviceName = null,
        port = 9001;

    t.throws(function () {
      emitter.startBroadcasting(deviceName, port, noop);
    });

    t.end();
  });
}

testThaliEmitter.prototype.doTest4 = function() {
  var self = this;
  self.emit('debug', "4.throw on empty string device name");
  self.test('#startBroadcasting should throw on empty string device name', function (t) {
    self.currentTest = t;
    var emitter = new ThaliEmitter();

    var deviceName = '',
        port = 9001;

    t.throws(function () {
      emitter.startBroadcasting(deviceName, port, noop);
    });

    t.end();
  });
}

testThaliEmitter.prototype.doTest5 = function() {
  var self = this;
  self.emit('debug', "5. throw on non-number port");
  self.test('#startBroadcasting should throw on non-number port', function (t) {
    self.currentTest = t;
    var emitter = new ThaliEmitter();

    var deviceName = 'foo',
        port = '9001';

    t.throws(function () {
      emitter.startBroadcasting(deviceName, port, noop);
    });
    t.end();
  });
}

testThaliEmitter.prototype.doTest6 = function() {
  var self = this;
  self.emit('debug', "6. throw on NaN port");
  self.test('#startBroadcasting should throw on NaN port', function (t) {
    self.currentTest = t;
    var emitter = new ThaliEmitter();

    var deviceName = 'foo',
        port = NaN;

    t.throws(function () {
      emitter.startBroadcasting(deviceName, port, noop);
    });

    t.end();
  });
}

testThaliEmitter.prototype.doTest7 = function() {
  var self = this;
  self.emit('debug', "7. throw on negative port");
  self.test('#startBroadcasting should throw on negative port', function (t) {
    self.currentTest = t;
    var emitter = new ThaliEmitter();

    var deviceName = 'foo',
        port = -1;

    t.throws(function () {
      emitter.startBroadcasting(deviceName, port, noop);
    });

    t.end();
  });
}

testThaliEmitter.prototype.doTest8 = function() {
  var self = this;
  self.emit('debug', "8. throw on too large port");
  self.test('#startBroadcasting should throw on too large port', function (t) {
    self.currentTest = t;
    var emitter = new ThaliEmitter();

    var deviceName = 'foo',
        port = 65537;

    t.throws(function () {
      emitter.startBroadcasting(deviceName, port, noop);
    });

    t.end();
  });
}

testThaliEmitter.prototype.doTest9 = function() {
  var self = this;
  self.emit('debug', "9. StartBroadcasting without an error");
  self.test('#startBroadcasting should call Mobile("StartBroadcasting") without an error', function (t) {
    self.currentTest = t;
    var emitter = new ThaliEmitter();

    var deviceName = 'foo',
        port = 9001;

    emitter.startBroadcasting(deviceName, port, function (err) {
      t.equal(Mobile('StartBroadcasting').callNativeArguments[0], deviceName);
      t.equal(Mobile('StartBroadcasting').callNativeArguments[1], port);
      t.equal(err, undefined);
      t.end();
    });

    Mobile.invokeStartBroadcasting();
  });
}

testThaliEmitter.prototype.doTest10 = function() {
  var self = this;
  self.emit('debug', "10. handle error with StartBroadcasting");
  self.test('#startBroadcasting should call Mobile("StartBroadcasting") and handle an error', function (t) {
    self.currentTest = t;
    var emitter = new ThaliEmitter();

    var deviceName = 'foo',
        port = 9001,
        errorMessage = 'fail';

    emitter.startBroadcasting(deviceName, port, function (err) {
      t.equal(Mobile('StartBroadcasting').callNativeArguments[0], deviceName);
      t.equal(Mobile('StartBroadcasting').callNativeArguments[1], port);
      t.equal(err.message, errorMessage);
      t.end();
    });

    Mobile.invokeStartBroadcasting(errorMessage);
  });
}

testThaliEmitter.prototype.doTest11 = function() {
  var self = this;
  self.emit('debug', "11. StopBroadcasting without an error");
  self.test('#stopBroadcasting should call Mobile("StopBroadcasting") without an error', function (t) {
    self.currentTest = t;
    var emitter = new ThaliEmitter();

    var deviceName = 'foo',
        port = 9001;

    emitter.startBroadcasting(deviceName, port, function (err) {

      emitter.stopBroadcasting(function (err) {
        t.equal(Mobile('StopBroadcasting').callNativeArguments.length, 1);
        t.equal(err, undefined);
        t.end();
      });

      Mobile.invokeStopBroadcasting();
    });

    Mobile.invokeStartBroadcasting();
  });
}

testThaliEmitter.prototype.doTest12 = function() {
  var self = this;
  self.emit('debug', "12. handle error with StopBroadcasting");
  self.test('#stopBroadcasting should call Mobile("StopBroadcasting") and handle an error', function (t) {
    self.currentTest = t;
    var emitter = new ThaliEmitter();

    var deviceName = 'foo',
        port = 9001,
        errorMessage = 'fail';

    emitter.startBroadcasting(deviceName, port, function (err) {

      emitter.stopBroadcasting(function (err) {
        t.equal(Mobile('StopBroadcasting').callNativeArguments.length, 1);
        t.equal(err.message, errorMessage);
        t.end();
      });

      Mobile.invokeStopBroadcasting(errorMessage);
    });

    Mobile.invokeStartBroadcasting();
  });
}

testThaliEmitter.prototype.doTest13 = function() {
  var self = this;
  self.emit('debug', "13. Connect without an error");
  self.test('#connect should call Mobile("Connect") with a port and without an error', function (t) {
    self.currentTest = t;
    var emitter = new ThaliEmitter();

    var peerIdentifier = '123',
        errorMessage = null,
        port = 9001;

    emitter.connect(peerIdentifier, function (err, localPort) {
      t.equal(Mobile('Connect').callNativeArguments[0], peerIdentifier);
      t.equal(port, localPort);
      t.equal(err, null);
      t.end();
    });

    Mobile.invokeConnect(errorMessage, port);
  });
}

testThaliEmitter.prototype.doTest14 = function() {
  var self = this;
  self.emit('debug', "14. Connect and handle an error");
  self.test('#connect should call Mobile("Connect") and handle an error', function (t) {
    self.currentTest = t;
    var emitter = new ThaliEmitter();

    var peerIdentifier = '123',
        errorMessage = 'fail',
        port = 9001;

    emitter.connect(peerIdentifier, function (err) {
      t.equal(Mobile('Connect').callNativeArguments[0], peerIdentifier);
      t.equal(err.message, errorMessage);
      t.end();
    });

    Mobile.invokeConnect(errorMessage, port);
  });
}

testThaliEmitter.prototype.doTest15 = function() {
  var self = this;
  self.emit('debug', "15. Disconnect without an error");
  self.test('should call Mobile("Disconnect") without an error', function (t) {
    self.currentTest = t;
    var emitter = new ThaliEmitter();

    var peerIdentifier = '123',
        port = 9001;

    emitter.connect(peerIdentifier, function () {

      emitter.disconnect(peerIdentifier, function (err) {
        t.equal(Mobile('Disconnect').callNativeArguments[0], peerIdentifier);
        t.equal(err, undefined);
        t.end();
      });

      Mobile.invokeDisconnect && Mobile.invokeDisconnect();
    });

    Mobile.invokeConnect(null, port);
  });
}

testThaliEmitter.prototype.doTest16 = function() {
  var self = this;
  self.emit('debug', "16. Disconnect and handle an error");
  self.test('should call Mobile("Disconnect") and handle an error', function (t) {
    self.currentTest = t;
    var emitter = new ThaliEmitter();

    var peerIdentifier = '123',
        port = 9001,
        errorMessage = 'fail';

    emitter.connect(peerIdentifier, function () {

      emitter.disconnect(peerIdentifier, function (err) {
        t.equal(Mobile('Disconnect').callNativeArguments[0], peerIdentifier);
        t.equal(err.message, errorMessage);
        t.end();
      });

      Mobile.invokeDisconnect(errorMessage);
    });

    Mobile.invokeConnect(null, port);
  });
}

testThaliEmitter.prototype.weAreDoneNow = function() {

  if (this.doneAlready) {
    return;
  }

  this.doneAlready = true;

  if (this.timerId != null) {
    clearTimeout(this.timerId);
    this.timerId = null;
  }

  console.log('weAreDoneNow');
  this.endTime = new Date();

  this.emit('debug', "---- finished : testThaliEmitter -- ");
  var responseTime = this.endTime - this.startTime;
  this.emit('done', JSON.stringify({
    "name:": this.name,
    "time": responseTime,
    "result": this.endReason,
    "testResult": this.testResults
  }));
}

module.exports = testThaliEmitter;

