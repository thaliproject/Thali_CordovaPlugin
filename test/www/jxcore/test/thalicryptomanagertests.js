"use strict";

require('./mockmobile');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var test = require('tape');
var cryptomanager = require('../thali/thalicryptomanager');


test('successfully create a new pkcs12 file and return hash value', function (t) {
  var errorMessage = null,
      fileLocation = './pkcs12foldergood';
  
  Mobile.storeGetDocumentsPathReturnArguments(errorMessage, fileLocation);
  
  cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
    t.equal(err, null);

    var file = path.join(fileLocation, cryptomanager.pkcs12FileName);
    fs.readFile(file, function (err, pkcs12Content) {
      if(err) {
        console.error('failed to read the pkcs12 file - err: ', err);
        t.end();
        return;
      }
      var publicKey = crypto.pkcs12.
        extractPublicKey(cryptomanager.password, pkcs12Content);
      if(!publicKey || publicKey.length <= 0) {
        console.error('extracted public key is invalid');
        t.end();
        return;
      }
      t.equal(publicKeyHash, cryptomanager.
        generateSlicedSHA256Hash(publicKey, cryptomanager.hashSizeInBytes));
    });
    t.end();
  });
});


test('successfully read a previous pkcs12 file and return hash value',
  function (t) {
  var errorMessage = null,
      fileLocation = './pkcs12foldergood';

  Mobile.storeGetDocumentsPathReturnArguments(errorMessage, fileLocation);

  var pkcs12Content = crypto.pkcs12.createBundle(cryptomanager.password,
    cryptomanager.certname, cryptomanager.country, cryptomanager.organization);
  if (pkcs12Content.length <= 0) {
    console.error('failed to create pkcs12 content');
    t.end();
    return;
  }

  var file = path.join(fileLocation, cryptomanager.pkcs12FileName);
  fs.writeFile(file, pkcs12Content, {flags: 'wx'}, function (err) {
    if (err) {
      console.error('failed to save pkcs12Content - err: ', err);
      t.end();
      return;
    }
    
    var publicKey = crypto.pkcs12.extractPublicKey(cryptomanager.password, pkcs12Content);
    if(!publicKey || publicKey.length <= 0) {
      console.error('extracted public key is invalid');
      t.end();
      return;
    }

    cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
      t.equal(err, null);
      t.equal(publicKeyHash, cryptomanager.
        generateSlicedSHA256Hash(publicKey, cryptomanager.hashSizeInBytes));
      t.end();
    });
  });
});

test('failed to extract public key because of corrupt pkcs12 file', function (t) {
  var errorMessage = null,
      fileLocation = './pkcs12folderbad';
      
  var cryptoErrorMessage = 'error thrown by extractPublicKey() function';

  Mobile.storeGetDocumentsPathReturnArguments(errorMessage, fileLocation);

  cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
    t.equal(err, cryptoErrorMessage);
    t.end();
  });
});

test('failed to get mobile documents path', function (t) {
  var errorMessage = 'GetDocumentsPath error',
      fileLocation = null;

  Mobile.storeGetDocumentsPathReturnArguments(errorMessage, fileLocation);
  
  cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
    t.equal(err, errorMessage);
    t.end();
  });
});
