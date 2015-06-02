(function () {

  var _peerIdentifierKey = 'PeerIdentifier';

  // Peers that we know about.
  var _peers = {};

  // Logs in Cordova.
  function logInCordova(text) {
    cordova('logInCordova').call(text);
  };

  // Gets the device name.
  function getDeviceName() {
    var deviceNameResult;
    cordova('GetDeviceName').callNative(function (deviceName) {
      logInCordova('GetDeviceName return was ' + deviceName);
      deviceNameResult = deviceName;
    });
    return deviceNameResult;
  };

  // Gets the peer identifier.
  function getPeerIdentifier() {
    var peerIdentifier;
    cordova('GetKeyValue').callNative(_peerIdentifierKey, function (value) {
      peerIdentifier = value;
      if (peerIdentifier == undefined) {
        cordova('MakeGUID').callNative(function (guid) {
          peerIdentifier = guid;
          cordova('SetKeyValue').callNative(_peerIdentifierKey, guid, function (response) {
            if (!response.result) {
              alert('Failed to save the peer identifier');
            }
          });
        });
      }
    });
    return peerIdentifier;
  };

/*
Helper functions
*/
  // Starts peer communications.
  function startPeerCommunications(peerIdentifier, peerName) {
    var result;
    cordova('StartPeerCommunications').callNative(peerIdentifier, peerName, function (value) {
      result = Boolean(value);
    });
    return result;
  };

  // Stops peer communications.
  function stopPeerCommunications(peerIdentifier, peerName) {
    cordova('StopPeerCommunications').callNative(function () {});
  };

function isFunction(functionToCheck) {
    var getType = {};
    return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}


  // inform connection status.
  function peerConnectionStateChanged(peerIdentifier, state) {

    console.log("peerConnectionStateChanged " + peerIdentifier + " to  state"   + state);
    if(isFunction(peerConnectionStatusCallback)){
        peerConnectionStatusCallback(peerIdentifier, state);
    }else{
        console.log("peerConnectionStatusCallback not set !!!!");
    }
  };

/*
helper variables
*/

  var peerIdentifier = getPeerIdentifier();
  var peerName = getDeviceName();


/*
Registred native functions
*/

  cordova('networkChanged').registerToNative(function (args) {
    logInCordova('networkChanged called');
    var network = args[0];
    logInCordova(JSON.stringify(network));

    if (network.isReachable) {
      logInCordova('****** NETWORK REACHABLE!!!');
    }

  });

  // Register peerNotConnected callback.
  cordova('peerNotConnected').registerToNative(function (peerId) {
        logInCordova('peerAvailabilityChanged called');

        peerConnectionStateChanged(peerId,"Disconnected");
  });

  // Register peerConnected callback.
  cordova('peerConnected').registerToNative(function (peerId) {
        logInCordova('peerAvailabilityChanged called');

        peerConnectionStateChanged(peerId,"Connected");
  });

  // Register peerConnecting callback.
  cordova('peerConnecting').registerToNative(function (peerId) {
        logInCordova('peerAvailabilityChanged called');

        peerConnectionStateChanged(peerId,"Connecting");
  });

  // Register peerAvailabilityChanged callback.
  cordova('peerAvailabilityChanged').registerToNative(function (args) {
    logInCordova('peerAvailabilityChanged called');
    var peers = args[0];

    console.log("peerChanged " + peers);
    if(isFunction(peerChangedCallback)){
        peerChangedCallback(args);
    }else{
        console.log("peerChangedCallback not set !!!!");
    }
  });


cordova('OnMessagingEvent').registerToNative(function(message){
    console.log("On-MessagingEvent:" + arguments.length + " arguments : msg: " + message);

    if(isFunction(MessageCallback)){
        MessageCallback(message);
    }else{
        console.log("MessageCallback not set !!!!");
    }
});


/*
funtions for Cordova app usage
*/
var MessageCallback;

cordova('setMessageCallback').registerAsync(function(callback){
    console.log("setMessageCallback  : " + callback);
    MessageCallback = callback;
});


var peerConnectionStatusCallback;
cordova('setConnectionStatusCallback').registerAsync(function(callback){
    console.log("setConnectionStatusCallback  : " + callback);
    peerConnectionStatusCallback = callback;
});

var peerChangedCallback;

cordova('setPeerChangedCallback').registerAsync(function(callback){
    console.log("setConnectionStatusCallback  : " + callback);
    peerChangedCallback = callback;
});



cordova('StartConnector').registerAsync(function(){

    logInCordova("StartConnector: ");
    startPeerCommunications(peerIdentifier,peerName);
});

cordova('StopConnector').registerAsync(function(){
    console.log("StopConnector called");
    stopPeerCommunications(peerIdentifier,peerName);
});



cordova('ConnectToDevice').registerAsync(function(address,callback){
    console.log("ConnectToDevice address : " + address);


    cordova('ConnectToDevice').callNative(address,function(){
      console.log("ConnectToDevice called");
    });
});

cordova('DisconnectPeer').registerAsync(function(address,callback){

    console.log("DisconnectPeer address : " + address);
    cordova('DisconnectPeer').callNative(address,function(){

      console.log("DisconnectPeer callback with " + arguments.length + " arguments");
      if(arguments.length > 1){
            callback(arguments[0].toString(),arguments[1].toString());
      }else{
            callback(arguments[0].toString(),"");
      }
    });
});


cordova('SendMessage').registerAsync(function(message,callback){

    console.log("SendMessage : " + message);
    cordova('SendMessage').callNative(message,function(){

      console.log("SendMessage callback with " + arguments.length + " arguments");
      if(arguments.length > 1){
            callback(arguments[0].toString(),arguments[1].toString());
      }else{
            callback(arguments[0].toString(),"");
      }
    });
});


cordova('ShowToast').registerAsync(function(message,isLong,callback){
    cordova('ShowToast').callNative(message,isLong,function(){
        //callback(arguments);
    });
});

/* jukka's old stuff starts here
*/

var isInForeground = false;

cordova('onLifeCycleEvent').registerToNative(function(message){
        console.log("LifeCycleEvent :" + message.lifecycleevent);

        if (message.lifecycleevent.localeCompare("onActivityCreated") == 0) {
            console.log("Activity was created");
            isInForeground = true;
        } else if (message.lifecycleevent.localeCompare("onActivityStarted") == 0) {
            console.log("Activity was started");
            isInForeground = true;
        } else if (message.lifecycleevent.localeCompare("onActivityResumed") == 0) {
            console.log("Activity was resumed");
            isInForeground = true;
        } else if (message.lifecycleevent.localeCompare("onActivityPaused") == 0) {
            console.log("Activity was paused");
            isInForeground = false;
        } else if (message.lifecycleevent.localeCompare("onActivityStopped") == 0) {
            console.log("Activity was stopped");
            isInForeground = false;
        } else if (message.lifecycleevent.localeCompare("onActivitySaveInstanceState") == 0) {
            console.log("Activity was save on instance event");
        } else if (message.lifecycleevent.localeCompare("onActivityDestroyed") == 0) {
            console.log("Activity was destroyed");
            isInForeground = false;
        } else {
            console.log("unknown LifeCycleEvent received !!!");
        }

        console.log("App is in foregound " + isInForeground);
});

  // Log that the app.js file was loaded.
  logInCordova('ThaliMobile app.js loaded');


})();