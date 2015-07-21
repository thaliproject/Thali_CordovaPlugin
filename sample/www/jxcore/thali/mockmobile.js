var keys = {};

function Mobile(key) {
  keys[key] || (keys[key] = new NativeCall(key));
  return keys[key];
}

Mobile.invokeNative = function (key, arg) {
  keys[key].registerNativeCallback(arg);
};

function invokeCallback(key, args) {
  var localArgs = keys[key].callNativeArguments;
  var cb = localArgs[localArgs.length - 1];
  cb.apply(null, args);
}

Mobile.invokeConnect = function () {
  var len = arguments.length, args = new Array(len);
  for (var i = 0; i < len; i++) { args[i] = arguments[i]; }
  invokeCallback('Connect', args);
};

Mobile.invokeDisconnect = function () {
  var len = arguments.length, args = new Array(len);
  for (var i = 0; i < len; i++) { args[i] = arguments[i]; }
  invokeCallback('Disconnect', args);
};

Mobile.invokeStartBroadcasting = function () {
  var len = arguments.length, args = new Array(len);
  for (var i = 0; i < len; i++) { args[i] = arguments[i]; }
  invokeCallback('StartBroadcasting', args);
};

Mobile.invokeStopBroadcasting = function () {
  var len = arguments.length, args = new Array(len);
  for (var i = 0; i < len; i++) { args[i] = arguments[i]; }
  invokeCallback('StopBroadcasting', args);
};

function NativeCall(key) {
  this.key = key;
  this.registerNativeCallback = null;
  this.callNativeArguments = null;
}

NativeCall.prototype = {
  registerToNative: function (cb) {
    this.registerNativeCallback = cb;
  },
  callNative: function () {
    this.callNativeArguments = arguments;
  }
};


global.Mobile = Mobile;
