
var mocks = {

  startListeningForAdvertisements : function(cb) {
    cb(null);
  },
  startUpdateAdvertisingAndListening : function(port, cb) {
    cb(null);
  },
  connect : function(peerIdentifer, cb) {
    console.log("connect");
    cb({});
  },
}

var registered = {};
var Mobile = function (key) {
  return  {
    callNative: function () {
      if (key in mocks) { 
        console.log("calling native: " + key);
        mocks[key](arguments[0], arguments[1]);
      }
      else {
        throw new Error("Mock does not implement: ", key);
      }
    },
    registerToNative: function (callback) {
      registered[key] = callback;
    },
    call: function() {
      if (key in registered) {
        console.log("calling node: " + key);
        registered[key](arguments[0], arguments[1]);
      }
      else {
        throw new Error("Function not registered: ", key);
      }     
    }
  }
}

module.exports = Mobile;
