"use strict";

var events = require('events');

var originalMobile = typeof Mobile === "undefined" ? undefined : Mobile;
var mockMobile = require('../mockmobile');
var fs = require('fs-extra-promise');
var path = require('path');
var crypto = require('crypto');
var tape = require('wrapping-tape');

var cryptomanager = require('thali/thalicryptomanager');
var os = require('os');

// get the values needed for running the tests
var configValues = cryptomanager.getConfigValuesForTestingOnly();
var fileLocation = path.join(os.tmpdir(), '../pkcs12folder');

function testThaliCryptoManager(jsonData,name) {
  var self = this;
  this.name = name;
  this.commandData = JSON.parse(jsonData);
  this.startTime = new Date();
  this.endTime = new Date();
  this.endReason = "";
  this.testResults = [];
  this.currentTest = null;

  this.test = tape({
    setup: function(t) {
      fs.ensureDirSync(fileLocation);
      global.Mobile = mockMobile;
      self.currentTest = null;
      t.end();
    },
    teardown: function(t) {
      global.Mobile = originalMobile;
      fs.removeSync(fileLocation);
      self.currentTest = null;
      self.currentTestNo++;
      self.doNextTest(self.currentTestNo);
      t.end();
    }
  });

  console.log('testThaliCryptoManager is created');
}

testThaliCryptoManager.prototype = new events.EventEmitter;

testThaliCryptoManager.prototype.start = function() {
  console.log('testThaliCryptoManager::start');
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

testThaliCryptoManager.prototype.stop = function(doReport) {
  console.log('testThaliCryptoManager::stop');

  if(doReport){
    this.weAreDoneNow();
  }

  if(this.currentTest != null) {
    this.currentTest.fail('stop was called while doing the test');
    this.currentTest = null;
  }
}

testThaliCryptoManager.prototype.doNextTest = function(testNo) {

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

testThaliCryptoManager.prototype.doTest1 = function() {
  var self = this;
  this.emit('debug', "1. create a new pkcs12 file and return hash --");

  this.test('successfully create a new pkcs12 file and return hash value',
      function (t) {
        this.currentTest = t;
        var errorMessage = null;

        Mobile.setGetDocumentsPathReturnValues(errorMessage, fileLocation);

        cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
          t.equal(err, null);

          var file = path.join(fileLocation, configValues.pkcs12FileName);
          fs.readFile(file, function (err, pkcs12Content) {
            t.ifError(err);
            t.doesNotThrow(function () {
              var publicKey = crypto.pkcs12.
                  extractPublicKey(configValues.password, pkcs12Content);
              t.ok(publicKey && publicKey.length > 0);
              t.equal(publicKeyHash, cryptomanager.
                  generateSlicedSHA256Hash(publicKey, configValues.hashSizeInBytes));
              t.end();
            });
          });
        });
      }
  );
}
testThaliCryptoManager.prototype.doTest2 = function() {
  var self = this;
  this.emit('debug', "2. read a previous pkcs12 file and return hash--");

  this.test('successfully read a previous pkcs12 file and return hash value',
      function (t) {
        this.currentTest = t;
        var errorMessage = null;

        Mobile.setGetDocumentsPathReturnValues(errorMessage, fileLocation);

        var pkcs12Content = crypto.pkcs12.createBundle(configValues.password,
            configValues.certname, configValues.country, configValues.organization);
        t.ok(pkcs12Content.length > 0);

        var file = path.join(fileLocation, configValues.pkcs12FileName);
        fs.writeFileSync(file, pkcs12Content, {flags: 'wx'});
        t.doesNotThrow(function () {
          var publicKey = crypto.pkcs12.
              extractPublicKey(configValues.password, pkcs12Content);
          t.ok(publicKey && publicKey.length > 0);
          cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
            t.equal(err, null);
            t.equal(publicKeyHash, cryptomanager.
                generateSlicedSHA256Hash(publicKey, configValues.hashSizeInBytes));
            t.end();
          });
        });
      }
  );
}

testThaliCryptoManager.prototype.doTest3 = function() {
  var self = this;
  this.emit('debug', "3. failed to extract public key (corrupt pkcs12)--");

  this.test('failed to extract public key because of corrupt pkcs12 file',
      function (t) {
        this.currentTest = t;
        var errorMessage = null,
            badFileLocation = path.join(__dirname, 'pkcs12folderbad');

        var cryptoErrorMessage = 'error thrown by extractPublicKey() function';

        Mobile.setGetDocumentsPathReturnValues(errorMessage, badFileLocation);

        cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
          t.equal(err, cryptoErrorMessage);
          t.end();
        });
      });
}

testThaliCryptoManager.prototype.doTest4= function() {
  var self = this;
  this.emit('debug', "4. failed to get mobile documents path--");
  this.test('failed to get mobile documents path', function (t) {
    this.currentTest = t;
    var errorMessage = 'GetDocumentsPath error',
        noFileLocation = null;
    Mobile.setGetDocumentsPathReturnValues(errorMessage, noFileLocation);
    cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
      t.equal(err, errorMessage);
      t.end();
    });
  });
}

testThaliCryptoManager.prototype.weAreDoneNow = function() {

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

  this.emit('debug', "---- finished : testThaliCryptoManager -- ");
  var responseTime = this.endTime - this.startTime;
  this.emit('done', JSON.stringify({
    "name:": this.name,
    "time": responseTime,
    "result": this.endReason,
    "testResult": this.testResults
  }));
}

module.exports = testThaliCryptoManager;

