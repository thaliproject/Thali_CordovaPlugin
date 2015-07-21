'use strict';

var crypto = require('crypto');
var fs = require('fs');

var pkcs12FileName = '/pkcs12.pfx';
var password = 'password';
var certname = 'certname';
var country = 'country';
var organization = 'organization';
var macName = 'SHA256';
var hashSizeInBytes = 16;

module.exports = {

/**
* Creates a PKCS12 content, saves it to a file, extracts the public
* key and returns it's SHA256 hash value.
*/  
  getPublicKeyHash: function (callback) {
    // get the path where the PKCS12 file is saved
    Mobile.GetDocumentsPath(function (err, fileLocation) {
      if (err) {
        console.error("GetDocumentsPath err: ", err);
        callback(null);
      } else {
        var file = fileLocation + pkcs12FileName;
        fs.exists(file, function (exists) {
          if(exists) {
            console.log('pkcs12 file exists');
            // read the file
            fs.readFile(file, function (err, pkcs12Content) {
              if (err) {
                console.log('failed to read pkcs12 file - err: ', err);
                callback(null);
              }
              console.log('successfully read pkcs12 file');
              // extract publick key
              var publicKey = crypto.pkcs12.extractPublicKey(password, pkcs12Content);
              if (publicKey.length <= 0) {
                console.log('failed to extract public key');
                callback(null);
              }
              console.log('generating SHA256 hash value');
              var hash = generateSHA256Hash(publicKey);
              callback(hash);
            });
          } else {
            console.log('pkcs12 file does not exist');
            // create pkcs12 bundle
            //TODO: allow the user to pass in these values
            var pkcs12Content = crypto.pkcs12.createBundle(password, certname, country, organization);
            if (pkcs12Content.length <= 0) {
              console.log('failed to create pkcs12 content');
              callback(null);
            }
            fs.writeFile(file, pkcs12Content, function (err) {
              if (err) {
                console.log('failed to save pkcs12Content - err: ', err);
                callback(null);
              }
              console.log('successfully saved pkcs12Content');
              // extract the public key
              console.log('extracting publicKey from pkcs12Content');
              var publicKey = crypto.pkcs12.extractPublicKey(password, pkcs12Content);
              if (publicKey.length <= 0) {
                console.log('failed to extract publicKey');
                callback(null);
              }
              console.log('generating SHA256 hash value');
              var hash = generateSHA256Hash(publicKey);
              callback(hash);
            }); //fs.writeFile
          } //file does not exist
        }); //fs.exists
      }
    }); //GetDocumentsPath
  }
  
};

/**
* Generates the SHA256 Hash of the input key and returns the first
* 'hashSizeInBytes' bytes.
* @param {String} publicKey whose has needs to be generated.
*/
function generateSHA256Hash(publicKey) { //Returns a "Buffer"
    var hash = crypto.createHash(macName);
    hash.update(publicKey); //already encoded to 'base64'
    var fullSizeKeyHash = hash.digest('base64');
    var slicedKeyIndex = fullSizeKeyHash.slice(0, hashSizeInBytes);
    var keyIndexByteArray = new Buffer(slicedKeyIndex);
    return keyIndexByteArray;
}
