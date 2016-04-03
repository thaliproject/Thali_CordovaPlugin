"use strict";

var originalMobile = typeof Mobile === "undefined" ? undefined : Mobile;
var mockMobile = require('./mockmobile');
var fs = require('fs-extra-promise');
var path = require('path');
var crypto = require('crypto');
var tape = require('../lib/thaliTape');
var cryptomanager = require('thali/thalicryptomanager');
var testUtils = require('../lib/testUtils.js');

// get the values needed for running the tests
var configValues = cryptomanager.getConfigValuesForTestingOnly();

var fileLocation = path.join(testUtils.tmpDirectory(), './pkcs12folder');

// test setup & teardown activities
var test = tape({
  setup: function(t) {
    fs.ensureDirSync(fileLocation);
    global.Mobile = mockMobile;
    t.end();
  },
  teardown: function(t) {
    global.Mobile = originalMobile;
    fs.removeSync(fileLocation);
    t.end();
  }
});

test('successfully create a new pkcs12 file and return hash value',
  function(t) {
    var errorMessage = null;

    Mobile.setGetDocumentsPathReturnValues(errorMessage, fileLocation);

    cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
      t.equal(err, null);

      var file = path.join(fileLocation, configValues.pkcs12FileName);
      fs.readFile(file, function (err, pkcs12Content) {
        t.ifError(err);
        t.doesNotThrow(function() {
          var publicKey = crypto.pkcs12.
              extractPublicKey(configValues.password, pkcs12Content);
          t.ok(publicKey && publicKey.length > 0);
          t.equal(publicKeyHash, cryptomanager.
              generateSlicedSHA256Hash(
                publicKey,
                configValues.hashSizeInBytes));
          t.end();
        });
      });
    });
  }
);

test('successfully read a previous pkcs12 file and return hash value',
  function (t) {
    var errorMessage = null;

    Mobile.setGetDocumentsPathReturnValues(errorMessage, fileLocation);

    var pkcs12Content = crypto.pkcs12.createBundle(configValues.password,
      configValues.certname, configValues.country, configValues.organization);
    t.ok(pkcs12Content.length > 0);

    var file = path.join(fileLocation, configValues.pkcs12FileName);
    fs.writeFileSync(file, pkcs12Content, {flags: 'wx'});
    t.doesNotThrow(function() {
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

test('failed to extract public key because of corrupt pkcs12 file',
  function (t) {
  var errorMessage = null,
      badFileLocation = path.join(__dirname, 'pkcs12folderbad');

  var cryptoErrorMessage = 'error thrown by extractPublicKey() function';

  Mobile.setGetDocumentsPathReturnValues(errorMessage, badFileLocation);

  cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
    t.equal(err.message, cryptoErrorMessage);
    t.end();
  });
});

test('failed to get mobile documents path', function(t) {
  var errorMessage = 'GetDocumentsPath error',
      noFileLocation = null;
  Mobile.setGetDocumentsPathReturnValues(errorMessage, noFileLocation);
  cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
    t.equal(err, errorMessage);
    t.end();
  });
});
