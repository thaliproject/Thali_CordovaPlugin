require('./mockmobilegetdocpath');
var test = require('tape');
var cryptomanager = require('../thali/thalicryptomanager');


test('successfully create a new pkcs12 file and return hash value', function (t) {
  var errorMessage = null,
      fileLocation = './pkcs12foldergood';

  var hashLength = 16;

  Mobile.storeGetDocumentsPathReturnArguments(errorMessage, fileLocation);
  
  cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
    t.equal(err, null);
    t.equal(publicKeyHash.length, hashLength);
    t.end();
  });
});

test('successfully read a previous pkcs12 file and return hash value', function (t) {
  var errorMessage = null,
      fileLocation = './pkcs12foldergood';

  var hashLength = 16;

  Mobile.storeGetDocumentsPathReturnArguments(errorMessage, fileLocation);
  
  cryptomanager.getPublicKeyHash(function (err, publicKeyHash) {
    t.equal(err, null);
    t.equal(publicKeyHash.length, hashLength);
    t.end();
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
