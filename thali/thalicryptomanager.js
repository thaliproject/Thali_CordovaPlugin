'use strict';

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

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
        callback(err);
      } else {
        var file = path.join(fileLocation, pkcs12FileName);
        getPKCS12Content(file, function(err, pkcs12Content) {
          if(err) {
            console.error('failed to get pkcs12 content');
            callback(err);
          }
          // extract publick key
          var publicKey = crypto.pkcs12.extractPublicKey(password, pkcs12Content);
          if (publicKey.length <= 0) {
            console.error('failed to extract public key');
            callback('failed to extract publicKey');
          }
          console.log('generating SHA256 hash value');
          var hash = generateSHA256Hash(publicKey);
          callback(null, hash);
        }); //getPKCS12Content
      }
    }); //GetDocumentsPath
  }
  
};

/**
* Reads the PKCS12 content from the given file if it exists. If not,
* the PKCS12 content is generated, saved to a file and the content is
* returned.
* @param {String} fileNameWithPath which has the PKCS12 content.
*/
function getPKCS12Content(fileNameWithPath, callback) {
  // check if file already exists
  fs.exists(fileNameWithPath, function (exists) {
    if(exists) {
      console.log('pkcs12 file exists');
      // read the file
      fs.readFile(fileNameWithPath, function (err, pkcs12Content) {
        if (err) {
          console.error('failed to read pkcs12 file - err: ', err);
          callback(err);
        }
        console.log('successfully read pkcs12 file');
        callback(null, pkcs12Content);
      });
    } else {
      // create pkcs12 content
      var pkcs12Content = crypto.pkcs12.createBundle(password, certname, country, organization);
      if (pkcs12Content.length <= 0) {
        console.error('failed to create pkcs12 content');
        callback('failed to create pkcs12Content');
      }
      // write to the file
      fs.writeFile(fileNameWithPath, pkcs12Content, function (err) {
        if (err) {
          console.error('failed to save pkcs12Content - err: ', err);
          callback(err);
        }
        console.log('successfully saved pkcs12Content');
        callback(null, pkcs12Content);
      });
    }
  });
}

/**
* Generates the SHA256 Hash of the input key and returns the first
* 'hashSizeInBytes' bytes.
* @param {String} publicKey whose hash needs to be generated.
*/
function generateSHA256Hash(publicKey) {
    var hash = crypto.createHash(macName);
    hash.update(publicKey); //already encoded to 'base64'
    var fullSizeKeyHash = hash.digest('base64');
    // slice it to the required size
    var slicedKeyHash = fullSizeKeyHash.slice(0, hashSizeInBytes);
    return slicedKeyHash;
}
