'use strict';

var fs = require('fs-extra-promise');
var os = require('os');
var path = require('path');
var Promise = require('lie');

function writeFiles(interfaceName, address) {
    function writeServerAddress(filePath) {
        return fs.writeFileAsync(path.join(filePath,"serveraddress.json"),
            JSON.stringify([{name: interfaceName, address: address}]));
    }

    console.log(interfaceName, address);
    return writeServerAddress(path.join(__dirname, "../www/jxcore"))
        .then(function() {
            return writeServerAddress(__dirname);
        });
}

module.exports = function(addressOverride) {
  if (addressOverride) {
    return writeFiles("override", addressOverride);
  }

  var networkInterfaces = os.networkInterfaces();

  var ipv4InterfaceName = null;
  var ipv4address= null;
  Object.keys(networkInterfaces).forEach(function (interfaceName) {
      networkInterfaces[interfaceName].forEach(function (iface) {
          if ('IPv4' !== iface.family || iface.internal !== false) {
              // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
              return;
          }

          // We prefer interfaces called Wi-Fi but if we can't find one then we will
          // take the first IPv4 address we can find that is not internal. The assumption
          // is that the non-Wi-Fi address is connected to a router that is connected to
          // Wi-Fi.
          if(interfaceName.indexOf("Wi-Fi") > -1){
              // this interface has only one ipv4 address
              return writeFiles(interfaceName, iface.address);
          }

          if (!ipv4InterfaceName) {
              ipv4InterfaceName = interfaceName;
              ipv4address = iface.address;
          }
      });
  });

  if (!ipv4InterfaceName) {
      return Promise.reject(new Error("We could not find an IPv4 external facing interface"));
  }

  return writeFiles(ipv4InterfaceName, ipv4address);
};
