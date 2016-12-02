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
  '_realName': {
    value: function () {
      return process.platform;
    }
  },
  '_isRealMobile': {
    get: function () {
      return this._isRealAndroid || this._isRealIOS;
    }

  },
  '_isRealAndroid': {
    get: function () {
      return process.platform === _platforms.ANDROID;
    }
  },
  '_isRealIOS': {
    get: function () {
      return process.platform === _platforms.IOS;
    }
  }
});
