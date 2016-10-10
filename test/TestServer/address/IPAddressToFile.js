'use strict';

var fs     = require('fs-extra-promise');
var os     = require('os');
var path   = require('path');
var assert = require('assert');

var Promise = require('../utils/Promise');
var logger  = require('../utils/ThaliLogger.js')('IPAddressToFile');


function writeFiles(address) {
  function writeServerAddress(filePath) {
    return fs.writeFileAsync(
      path.join(filePath, 'server-address.js'),
      'module.exports = \'' + address + '\';\r\n'
    );
  }

  return Promise.all([
    writeServerAddress(
      path.join(__dirname, '../../www/jxcore')
    ),
    writeServerAddress(
      path.join(__dirname, '..')
    )
  ]);
}

// We prefer interfaces called 'Wi-Fi' but if we can't find one then we
// will take the first IPv4 address we can find that is not internal.
// The assumption is that the non-Wi-Fi address is connected to a router
// that is connected to Wi-Fi.
var NETWORK_INTERFACE_NAME = 'Wi-Fi';

module.exports = function (addressOverride) {
  if (addressOverride) {
    return writeFiles(addressOverride);
  }

  var osInterfaces = os.networkInterfaces();

  var osInterfaceNames = Object.keys(osInterfaces)
  .sort(function (osInterfaceName1, osInterfaceName2) {
    if (osInterfaceName1 === osInterfaceName2) {
      return 0;
    } else if (osInterfaceName1.indexOf(NETWORK_INTERFACE_NAME) !== -1) {
      return -1;
    } else if (osInterfaceName2.indexOf(NETWORK_INTERFACE_NAME) !== -1) {
      return 1;
    } else {
      return osInterfaceName1.localeCompare(osInterfaceName2);
    }
  });
  logger.debug('found network interfaces:', JSON.stringify(osInterfaceNames));

  osInterfaces = osInterfaceNames.map(function (osInterfaceName) {
    return osInterfaces[osInterfaceName];
  });

  var ifaces = osInterfaces.reduce(function (ifaces, osInterface) {
    return ifaces.concat(osInterface);
  }, [])
  .filter(function (iface) {
    return iface.family === 'IPv4' && !iface.internal;
  });

  assert(
    ifaces.length > 0,
    'we should be able to find a valid ip address for server'
  );

  var address = ifaces[0].address;
  logger.debug('found a valid ip address for server: \'%s\'', address);
  return writeFiles(address);
};
