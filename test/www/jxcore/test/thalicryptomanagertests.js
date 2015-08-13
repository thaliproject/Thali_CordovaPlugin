"use strict";

require('./mockmobile');
var fs = require('fs-extra-promise');
var path = require('path');
var crypto = require('crypto');
var tape = require('wrapping-tape');
var cryptomanager = require('../thali/thalicryptomanager');

// get the values needed for running the tests
var configValues = cryptomanager.getConfigValuesForTestingOnly();

var fileLocation = './pkcs12folder';

// test setup & teardown activities
var test = tape({
  setup: function(t) {
    fs.mkdirSync(fileLocation);
    t.end();
  },
  teardown: function(t) {
    fs.remove(fileLocation, function(err) {
      if(err) {
        console.log('could not remove folder - err: ', err);
      }
      t.end();
    });
  }
});

test('successfully create a new pkcs12 file and return hash value', 2,
  function(t) {
  var errorMessage = null;
  
  Mobile.storeGetDocumentsPathReturnArguments(errorMessage, fileLocation);
  
  cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
    t.equal(err, null);

    var file = path.join(fileLocation, configValues.pkcs12FileName);
    fs.readFile(file, function (err, pkcs12Content) {
      if(err) {
        console.error('failed to read the pkcs12 file - err: ', err);
        t.end();
        return;
      }
      try {
        var publicKey = crypto.pkcs12.
          extractPublicKey(configValues.password, pkcs12Content);
        if(!publicKey || publicKey.length <= 0) {
          console.error('extracted public key is invalid');
          t.end();
          return;
        }
      } catch(err) {
        console.error('extractPublicKey err: ', err);
        t.end();
        return;
      }
      t.equal(publicKeyHash, cryptomanager.
        generateSlicedSHA256Hash(publicKey, configValues.hashSizeInBytes));
    });
  });
});

test('successfully read a previous pkcs12 file and return hash value', 2,
  function (t) {
  var errorMessage = null;

  Mobile.storeGetDocumentsPathReturnArguments(errorMessage, fileLocation);
  
  var pkcs12Content = crypto.pkcs12.createBundle(configValues.password,
    configValues.certname, configValues.country, configValues.organization);
  if (pkcs12Content.length <= 0) {
    console.error('failed to create pkcs12 content');
    t.end();
    return;
  }

  var file = path.join(fileLocation, configValues.pkcs12FileName);
  fs.writeFile(file, pkcs12Content, {flags: 'wx'}, function (err) {
    if (err) {
      console.error('failed to save pkcs12Content - err: ', err);
      t.end();
      return;
    }
    
    try {
      var publicKey = crypto.pkcs12.
      extractPublicKey(configValues.password, pkcs12Content);
      if(!publicKey || publicKey.length <= 0) {
        console.error('extracted public key is invalid');
        return;
      }
    } catch(err) {
      console.error('extractPublicKey err: ', err);
      t.end();
      return;
    }

    cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
      t.equal(err, null);
      t.equal(publicKeyHash, cryptomanager.
        generateSlicedSHA256Hash(publicKey, configValues.hashSizeInBytes));
    });
  });
});

test('failed to extract public key because of corrupt pkcs12 file', 1,
  function (t) {
  var errorMessage = null,
      badFileLocation = './pkcs12folderbad';
      
  var cryptoErrorMessage = 'error thrown by extractPublicKey() function';

  Mobile.storeGetDocumentsPathReturnArguments(errorMessage, badFileLocation);

  cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
    t.equal(err, cryptoErrorMessage);
  });
});

test('failed to get mobile documents path', 1, function(t) {
  var errorMessage = 'GetDocumentsPath error',
      noFileLocation = null;
  Mobile.storeGetDocumentsPathReturnArguments(errorMessage, noFileLocation);
  cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
    t.equal(err, errorMessage);
  });
});
