(function () {

  var CoordinatorConnector = require('CoordinatorConnector');
  var TestFrameworkClient = require('TestFrameworkClient');

  /*----------------------------------------------------------------------------------
   code for connecting to the coordinator server
   -----------------------------------------------------------------------------------*/
  fs = require('fs');
  var parsedJSON = require('ipaddress.json');
  var myName = "DEV" + Math.round((Math.random() * (10000)));

  console.log('my name is : ' + myName);
  console.log('Connect to  address : ' + parsedJSON[0].address + ' type: ' + parsedJSON[0].name);

  var Coordinator = new CoordinatorConnector();
  Coordinator.init(parsedJSON[0].address, 3000);
  console.log('attempting to connect to test coordinator');

  Coordinator.on('error', function (data) {
    var errData = JSON.parse(data);
    console.log('Error:' + data + ' : ' + errData.type +  ' : ' + errData.data);
    logMessageToScreen('Client error: ' + errData.type);
  });

  /*----------------------------------------------------------------------------------
   code for handling test communications
   -----------------------------------------------------------------------------------*/
  var TestFramework = new TestFrameworkClient(myName);
  TestFramework.on('done', function (data) {
    console.log('done, sending data to server');
    Coordinator.sendData(data);
  });
  TestFramework.on('debug', function (data) {
    logMessageToScreen(data);
  });

  Coordinator.on('connect', function () {
    console.log('Client has connected to the server!');
    logMessageToScreen('connected to server');
    Coordinator.identify(myName);
  });

  Coordinator.on('command', function (data) {
    console.log('command received : ' + data);
    TestFramework.handleCommand(data);
  });

  // Add a disconnect listener
  Coordinator.on('disconnect', function () {
    console.log('The client has disconnected!');
    //we need to stop & close any tests we are runnign here
    TestFramework.stopAllTests(false);
    logMessageToScreen('disconnected');
  });

  /***************************************************************************************
   functions for Cordova side application, used for showing logs & sending test messages
   ***************************************************************************************/

  function isFunction(functionToCheck) {
    var getType = {};
    return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
  }

  var LogCallback;

  function logMessageToScreen(message) {
    if (isFunction(LogCallback)) {
      LogCallback(message);
    } else {
      console.log("LogCallback not set !!!!");
    }
  }

  Mobile('setLogCallback').registerAsync(function (callback) {
    LogCallback = callback;
  });

  Mobile('getMyName').registerAsync(function (callback) {
    callback(myName);
  });

  // Log that the app.js file was loaded.
  console.log('Test app app.js loaded');
})();


