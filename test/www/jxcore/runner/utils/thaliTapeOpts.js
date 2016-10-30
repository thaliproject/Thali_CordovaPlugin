'use strict';
var Promise = require('lie');
var testUtils = require('../../lib/testUtils');

// Opts needed for thaliTape.begin method
var thaliTapeOpts = null;
/**
 *  @returns {Promise<Object>} resolved Promise with thaliTapeOpts
 */
module.exports = function () {
  if (thaliTapeOpts) {
    return Promise.resolve(thaliTapeOpts);
  } else {
    return testUtils.hasRequiredHardware()
      .then(function (hasRequiredHardware) {
        return testUtils.getOSVersion()
          .then(function (version) {
            thaliTapeOpts = {
              version: version,
              hasRequiredHardware: hasRequiredHardware
            };
            return thaliTapeOpts;
          });
      });
  }
}