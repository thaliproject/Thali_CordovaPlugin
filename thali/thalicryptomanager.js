'use strict';

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');


// The password is not secure because anyone who can get to the file can get
// to the app and thus can get the password. The password is used here only to
// satisfy the crypto/PKCS12 APIs.
var password = 'password';
var certname = 'certname';
var country = 'country';
var organization = 'organization';
var pkcs12FileName = '/pkcs12.pfx';
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
          
          try {
            // extract the public key
            var publicKey = crypto.pkcs12
              .extractPublicKey(password, pkcs12Content);
            // check if the extracted public key is good
            if ( !publicKey || publicKey.length <= 0) {
              console.error('extracted public key is invalid');
              cb('extracted public key is invalid');
            }
            var hash = generateSlicedSHA256Hash(publicKey, hashSizeInBytes);
            cb(null, hash);
          } catch(e) {
            console.error('error thrown by extractPublicKey() function');
            cb('error thrown by extractPublicKey() function');
          }
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
  fs.exists(fileNameWithPath, function (exists) {
    if(exists) {
      fs.readFile(fileNameWithPath, function (err, pkcs12Content) {
        if (err) {
          console.error('failed to read the pkcs12 file - err: ', err);
          cb(err);
        }
        cb(null, pkcs12Content);
      });
    } else {
      var pkcs12Content = crypto.pkcs12
        .createBundle(password, certname, country, organization);
        if (pkcs12Content.length <= 0) {
          console.error('failed to create pkcs12 content');
          cb('failed to create pkcs12Content');
        }
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

function generateSlicedSHA256Hash(stringValueToHash, hashSizeInBytes) {
  var hash = crypto.createHash(macName);
  hash.update(stringValueToHash);
  var fullSizeKeyHash = hash.digest('base64');
  var slicedKeyHash = fullSizeKeyHash.slice(0, hashSizeInBytes);
  return slicedKeyHash;
}
