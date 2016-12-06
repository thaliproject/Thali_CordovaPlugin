'use strict';

module.exports = function () {
  var platform = require('thali/NextGeneration/utils/platform');
  var argv = require('minimist')(process.argv.slice(2));
  if (!argv.platform) {
    return null;
  }
  switch (argv.platform) {
    case platform.names.IOS:
    case platform.names.ANDROID: {
      return argv.platform;
    }
    default: {
      throw new Error('Unrecognized platform: ' + argv.platform + '. ' +
        'Available platforms: ' + JSON.stringify(platform.names));
    }
  }
};
