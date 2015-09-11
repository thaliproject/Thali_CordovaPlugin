'use strict';


var tape = require('wrapping-tape');
var events = require('events');
var ThaliEmitter = require('thali/thaliemitter');

function testThaliNativeLayer(jsonData,name) {
  var self = this;
  this.name = name;
  this.commandData = JSON.parse(jsonData);
  this.startTime = new Date();
  this.endTime = new Date();
  this.endReason = "";
  this.testResults = [];
  this.currentTest = null;

  this.testServerPort = 8876; //we are actuall not connecting, so we can use fake port here

  this.test = tape({
    setup: function(t) {
      self.currentTest = null;
      t.end();
    },
    teardown: function(t) {
      self.currentTest = null;
      self.currentTestNo++;
      self.doNextTest(self.currentTestNo);
      t.end();
    }
  });

  console.log('testThaliNativeLayer is created');

/*  test.createStream({ objectMode: true }).on('data', function (row) {
    console.log(JSON.stringify(row));
    self.testResults.push(row);
  });*/
}

testThaliNativeLayer.prototype = new events.EventEmitter;

testThaliNativeLayer.prototype.start = function() {
  var self = this;
  this.startTime = new Date();

  if (!jxcore.utils.OSInfo().isMobile) {
    this.endReason = "Not mobile environment";
    this.weAreDoneNow();
    return;
  }

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

testThaliNativeLayer.prototype.stop = function(doReport) {
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

testThaliNativeLayer.prototype.doNextTest = function(testNo) {

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
    default:
      this.endReason = "OK";
      this.stop(true);
      break;
  }
}

testThaliNativeLayer.prototype.doTest1 = function() {
  var self = this;
  this.emit('debug', "1. start/stopBroadcasting repeatedly --");
  console.log('DEBUG 1');
  this.test('ThaliEmitter can call repeatedly startBroadcasting and stopBroadcasting without error', function (t) {
    console.log('DEBUG 2');
    var e = new ThaliEmitter();
    self.currentTest = t;

    function repeatCalls(count) {
      if (count == 0) {
        t.end();
        return;
      }


      e.startBroadcasting(self.name, self.testServerPort, function (err1) {
        t.notOk(err1, 'Should be able to call startBroadcasting without error');
        e.stopBroadcasting(function (err2) {
          t.notOk(err2, 'Should be able to call stopBroadcasting without error');
          repeatCalls(count - 1);
        });
      });
    }

    repeatCalls(10);
  });
}

testThaliNativeLayer.prototype.doTest2 = function() {
  var self = this;
  this.emit('debug', "2. startBroadcasting twice --");

  this.test('ThaliEmitter calls startBroadcasting twice with error', function (t) {
    var e = new ThaliEmitter();
    self.currentTest = t;

    e.startBroadcasting(self.name, self.testServerPort, function (err1) {
      t.notOk(err1, 'Should be able to call startBroadcasting without error');

      e.startBroadcasting(self.name, self.testServerPort, function (err2) {

        t.assert(!!err2, 'Cannot call startBroadcasting twice');

        e.stopBroadcasting(function (err3) {
          t.notOk(err3, 'Should be able to call stopBroadcasting without error');
          t.end();
        });
      });
    });
  });
}

testThaliNativeLayer.prototype.doTest3 = function() {
  var self = this;
  this.emit('debug', "3. connection to bad peer --");

  this.test('ThaliEmitter throws on connection to bad peer', function (t) {
    var e = new ThaliEmitter();
    self.currentTest = t;

    e.startBroadcasting(self.name, self.testServerPort, function (err1) {
      t.notOk(err1, 'Should be able to call startBroadcasting without error');

      e.connect('foobar', function (err2, port) {
        t.assert(!!err2, 'Should not connect to a bad peer');

        e.stopBroadcasting(function (err3) {
          t.notOk(err3, 'Should be able to call stopBroadcasting without error');
          t.end();
        });
      });
    });
  });
}

testThaliNativeLayer.prototype.doTest4 = function() {
  var self = this;
  this.emit('debug', "4. disconnect to bad peer --");

  this.test('ThaliEmitter throws on disconnect to bad peer', function (t) {
    var e = new ThaliEmitter();
    self.currentTest = t;

    e.startBroadcasting(self.name, self.testServerPort, function (err1) {
      t.notOk(err1, 'Should be able to call startBroadcasting without error');

      e.disconnect('foobar', function (err2, port) {
        t.assert(!!err2, 'Disconnect should fail to a non-existant peer ');

        e.stopBroadcasting(function (err3) {
          t.notOk(err3, 'Should be able to call stopBroadcasting without error');
          t.end();
        });
      });
    });
  });
}


testThaliNativeLayer.prototype.weAreDoneNow = function() {

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

  this.emit('debug', "---- finished : testThaliNativeLayer -- ");
  var responseTime = this.endTime - this.startTime;
  this.emit('done', JSON.stringify({
    "name:": this.name,
    "time": responseTime,
    "result": this.endReason,
    "testResult": this.testResults
  }));
}

module.exports = testThaliNativeLayer;