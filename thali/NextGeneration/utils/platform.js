'use strict';

var _platforms = {
  ANDROID: 'android',
  IOS: 'ios'
};

var _platform = process.platform;

// All the properties are in the readonly mode
module.exports = Object.defineProperties({}, {
    'name': {
      get: function () {
        return _platform;
      }
    },
    'names' : {
      get: function () {
        return _platforms;
      }
    },
    'isMobile': {
      get: function () {
        return this.isAndroid || this.isIOS;
      }

    },
    'isAndroid': {
      get: function () {
        return _platform === _platforms.ANDROID;
      }
    },
    'isIOS': {
      get: function () {
        return _platform === _platforms.IOS;
      }
    },
    // The methods presented below ONLY for testing reasons
    '_override': {
      value: function (platform) {
        return _platform = platform;
      }
    },
    '_restore': {
      value: function () {
        return _platform = process.platform;
      }
    },
    // Returns REAL values based on `process.platform`
    '_name': {
      value: function () {
        return process.platform;
      }
    },
    '_isMobile': {
      get: function () {
        return this._isAndroid || this._isIOS;
      }

    },
    '_isAndroid': {
      get: function () {
        return process.platform === _platforms.ANDROID;
      }
    },
    '_isIOS': {
      get: function () {
        return process.platform === _platforms.IOS;
      }
    },
  });