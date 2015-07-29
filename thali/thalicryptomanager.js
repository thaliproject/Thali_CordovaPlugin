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
* Checks if a PKCS12 file exists in a known location and if not present, it is
* created. The public key is extracted from the PKCS12 content and it's SHA256
* hash value is returned.
* @param {Function} cb the callback which returns an error or the hash value.
*/
  getPublicKeyHash: function (cb) {
    // get the path where the PKCS12 file is saved
    Mobile.GetDocumentsPath(function (err, fileLocation) {
      if (err) {
        console.error("GetDocumentsPath err: ", err);
        cb(err);
      } else {
        var file = path.join(fileLocation, pkcs12FileName);
        getPKCS12Content(file, function(err, pkcs12Content) {
          if(err) {
            console.error('failed to get pkcs12 content');
            cb(err);
          }
          // extract the publick key
          var publicKey = crypto.pkcs12
            .extractPublicKey(password, pkcs12Content);
            if (publicKey.length <= 0) {
              console.error('failed to extract public key');
              cb('failed to extract publicKey');
            }
          var hash = generateSHA256Hash(publicKey);
          cb(null, hash);
        }); //getPKCS12Content
      }
    }); //GetDocumentsPath
  }
};

/**
* Reads the PKCS12 content from the given file if it exists. If not,
* the PKCS12 content is generated, saved to a file and the content is
* returned.
* @param {String} fileNameWithPath the file which has the PKCS12 content.
* @param {Function} cb the callback which returns an error or PKCS12 content.
*/
function getPKCS12Content(fileNameWithPath, cb) {
  // check if file already exists
  fs.exists(fileNameWithPath, function (exists) {
    if(exists) {
      // read the file
      fs.readFile(fileNameWithPath, function (err, pkcs12Content) {
        if (err) {
          console.error('failed to read the pkcs12 file - err: ', err);
          cb(err);
        }
        cb(null, pkcs12Content);
      });
    } else {
      // create pkcs12 content.
      // the password is not secure because anyone who can get to the file can
      // get to the app and thus can get the password.
      // the password is used here only to satisfy the crypto/PKCS12 API.
      var pkcs12Content = crypto.pkcs12
        .createBundle(password, certname, country, organization);
        if (pkcs12Content.length <= 0) {
          console.error('failed to create pkcs12 content');
          cb('failed to create pkcs12Content');
        }
      // write to the file
      fs.writeFile(fileNameWithPath, pkcs12Content, function (err) {
        if (err) {
          console.error('failed to save pkcs12Content - err: ', err);
          cb(err);
        }
        cb(null, pkcs12Content);
      });
    }
  });
}

/**
* Generates the SHA256 Hash of the input key and returns the first
* 'hashSizeInBytes' bytes.
* @param {String} publicKey the piblic key whose hash needs to be generated.
*/
function generateSHA256Hash(publicKey) {
  var hash = crypto.createHash(macName);
  hash.update(publicKey); //already encoded to 'base64'
  var fullSizeKeyHash = hash.digest('base64');
  // slice it to the required size
  var slicedKeyHash = fullSizeKeyHash.slice(0, hashSizeInBytes);
  return slicedKeyHash;
}
