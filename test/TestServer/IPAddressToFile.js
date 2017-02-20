'use strict';

var fs = require('fs-extra-promise');
var os = require('os');
var path = require('path');

var forEach = require('lodash.foreach');
var Promise = require('./utils/Promise');


function writeFiles(address) {
  function writeServerAddress(filePath) {
    return fs.writeFileAsync(path.join(filePath, 'server-address.js'),
          'module.exports = "' + address + '";');
  }

  return writeServerAddress(path.join(__dirname, '../www/jxcore'))
      .then(function () {
        return writeServerAddress(__dirname);
      });
}

module.exports = function (addressOverride) {
  if (addressOverride) {
    return writeFiles(addressOverride);
  }

  var networkInterfaces = os.networkInterfaces();

  var ipv4address= null;
  forEach(networkInterfaces, function (addresses, interfaceName) {
    addresses.forEach(function (addressInfo) {
      if ('IPv4' !== addressInfo.family || addressInfo.internal !== false) {
          // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
        return;
      }

      // We prefer interfaces called Wi-Fi but if we can't find one then we
      // will take the first IPv4 address we can find that is not internal.
      // The assumption is that the non-Wi-Fi address is connected to a router
      // that is connected to Wi-Fi.
      if (interfaceName.indexOf('Wi-Fi') > -1){
          // this interface has only one ipv4 address
        ipv4address = addressInfo.address;
      }

      if (!ipv4address) {
        ipv4address = addressInfo.address;
      }
    });
  });

  if (!ipv4address) {
    return Promise.reject(
      new Error('We could not find an IPv4 external facing interface'));
  }

  return writeFiles(ipv4address);
};
