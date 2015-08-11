"use strict";

require('./mockmobile');
var fs = require('fs-extra-promise');
var path = require('path');
var crypto = require('crypto');
var test = require('tape');
var cryptomanager = require('../thali/thalicryptomanager');

test('successfully create a new pkcs12 file and return hash value', function (t) {
  var errorMessage = null,
      fileLocation = './pkcs12folder';
  
  fs.mkdirSync(fileLocation);
  
  Mobile.storeGetDocumentsPathReturnArguments(errorMessage, fileLocation);
  
  cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
    t.equal(err, null);

    var file = path.join(fileLocation, cryptomanager.getPkcs12FileName());
    fs.readFile(file, function (err, pkcs12Content) {
      if(err) {
        console.error('failed to read the pkcs12 file - err: ', err);
        fs.remove(fileLocation, function(err) {
          if(err) {
            console.log('could not remove folder - err: ', err);
          }
          t.end();
          return;
        });
      }
      var publicKey = crypto.pkcs12.
        extractPublicKey(cryptomanager.getPassword(), pkcs12Content);
      if(!publicKey || publicKey.length <= 0) {
        console.error('extracted public key is invalid');
        fs.remove(fileLocation, function(err) {
          if(err) {
            console.log('could not remove folder - err: ', err);
          }
          t.end();
          return;
        });
      }
      t.equal(publicKeyHash, cryptomanager.
        getSlicedSHA256Hash(publicKey, cryptomanager.getHashSizeInBytes()));
      fs.remove(fileLocation, function(err) {
        if(err) {
          console.log('could not remove folder - err: ', err);
        }
        t.end();
      });
    });
  });
});

test('successfully read a previous pkcs12 file and return hash value',
  function (t) {
  var errorMessage = null,
      fileLocation = './pkcs12folder';

  fs.mkdirSync(fileLocation);

  Mobile.storeGetDocumentsPathReturnArguments(errorMessage, fileLocation);

  var pkcs12Content = crypto.pkcs12.createBundle(cryptomanager.getPassword(),
    cryptomanager.getCertname(), cryptomanager.getCountry(), cryptomanager.getOrganization());
  if (pkcs12Content.length <= 0) {
    console.error('failed to create pkcs12 content');
    fs.remove(fileLocation, function(err) {
      if(err) {
        console.log('could not remove folder - err: ', err);
      }
      t.end();
      return;
    });
  }

  var file = path.join(fileLocation, cryptomanager.getPkcs12FileName());
  fs.writeFile(file, pkcs12Content, {flags: 'wx'}, function (err) {
    if (err) {
      console.error('failed to save pkcs12Content - err: ', err);
      fs.remove(fileLocation, function(err) {
        if(err) {
          console.log('could not remove folder - err: ', err);
        }
        t.end();
        return;
      });
    }
    
    var publicKey = crypto.pkcs12.
    extractPublicKey(cryptomanager.getPassword(), pkcs12Content);
    if(!publicKey || publicKey.length <= 0) {
      console.error('extracted public key is invalid');
      fs.remove(fileLocation, function(err) {
        if(err) {
          console.log('could not remove folder - err: ', err);
        }
        t.end();
        return;
      });
    }

    cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
      t.equal(err, null);
      t.equal(publicKeyHash, cryptomanager.
        getSlicedSHA256Hash(publicKey, cryptomanager.getHashSizeInBytes()));
      fs.remove(fileLocation, function(err) {
        if(err) {
          console.log('could not remove folder - err: ', err);
        }
        t.end();
      });
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
