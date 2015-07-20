//
//  The MIT License (MIT)
//
//  Copyright (c) 2015 Microsoft
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//  THE SOFTWARE.
//
//  Thali Cordova Plugin
//  thali_main.js
//
// cordova side - connecting the UI to jxcore on app.js
(function () {

  // Find out when JXcore is loaded.
  var jxcoreLoadedInterval = setInterval(function () {
    // HACK Repeat until jxcore is defined. When it is, it's loaded.
    if (typeof jxcore == 'undefined') {
      return;
    }

    // JXcore is loaded. Stop interval.
    clearInterval(jxcoreLoadedInterval);

    // Set the ready function.
    jxcore.isReady(function () {
      // Log that JXcore is ready.
      console.log('JXcore ready');

      // Share JavaScript functions from Cordova to JXcore
      registerCordovaFunctions();

      // Load app.js.
      jxcore('app.js').loadMainFile(function (ret, err) {
        if (err) {
          alert('Error loading ThaliMobile app.js');
          alert(err);
        } else {
          addChatLine("Cordova", "*** LOADED ***"); // logInCordova('Loaded');
          jxcore_ready();
        }
      });
    });
  }, 10);

  // Enable these functions for use within app.js
  function registerCordovaFunctions() {
    jxcore('alert').register(function(msg){ alert(msg); });
    jxcore('logInCordova').register(logInCordova); // takes function name
    // JX calls to Cordova UI functions
    jxcore('peerClientConnectionCallback').register(peerClientConnectionCallback);
    jxcore('peerServerConnectionCallback').register(peerServerConnectionCallback);
  }

  // Device name and identifier
  var _peerName = "ios";

  // The peer identifier key. This is a temporary setting we're using to ensure that
  // each time the sample is run on a device it uses the same peer identifier. In an
  // actual Thali app, this value would come from the app in some way.
  var _peerIdentifier = null,
      _peerIdentifierKey = 'PeerIdentifier';

  // UI element ids
  var startButtonId = "startButton",
      stopButtonId = "stopButton",
      sendButtonId = "sendButton",
      clearMessagesButtonId = "clearMessagesButton",
      disconnectButtonId = "disconnectButton",
      nameBoxId = "nameBox",
      replyBoxId = "replyBox",
      logEntriesId = "logEntries",
      peerListSelectorId = "peerListSelector",
      myRemoteDeviceId = "myRemoteDevice",
      myDeviceSelectionId = "myDeviceSelection",
      remAddrBoxId = "remAddrBox";

  // UI events (index.html)
  function jxcore_ready() {
    nslog("//jxcore_ready");
    document.getElementById(startButtonId).addEventListener("click", startBroadcasting);
    document.getElementById(stopButtonId).addEventListener("click", stopBroadcasting);
    document.getElementById(sendButtonId).addEventListener("click", sendMessage);
    document.getElementById(clearMessagesButtonId).addEventListener("click", clearMessages);
    document.getElementById(disconnectButtonId).addEventListener("click", disconnectPeer);
    deviceInfo();
  }

  function deviceInfo() {
    // get device name
    jxcore('getDeviceName').call( function(result){
      _peerName = result;
      nslog("peer name: " + _peerName );
      document.getElementById(nameBoxId).value = _peerName; // update name
    });
    // get peer identifier
    jxcore('getPeerIdentifier').call(_peerIdentifierKey, function(result){
      _peerIdentifier = result;
      nslog("peer id: " + _peerIdentifier );
    });
  }

  // UI click event handlers
  function startBroadcasting() {
    nslog(">>> Start Broadcasting");
    document.getElementById(stopButtonId).style.display = 'block';
    document.getElementById(startButtonId).style.display = 'none';

    // set cordova callbacks
    jxcore('setPeerChangedCallback').call(peersChangedCallback);
    jxcore('setConnectionStatusCallback').call(peersConnectionStateCallback);

    // start connector
    jxcore('StartBroadcasting').call(_peerIdentifier, _peerName);
  }

  function stopBroadcasting() {
    nslog(">>> Stop Broadcasting");
    document.getElementById(stopButtonId).style.display = 'none';
    document.getElementById(startButtonId).style.display = 'block';
    document.getElementById(myRemoteDeviceId).style.display = 'none';
    document.getElementById(myDeviceSelectionId).style.display = 'none';

    // stop
    jxcore('StopBroadcasting').call(_peerIdentifier, _peerName);

    clearLogs();
  }

  function sendMessage() {
    nslog("sendMessage");
  }

  function clearMessages() {
    nslog("clearMessages");
  }

  function disconnectPeer() {
    nslog("disconnectPeer");
  }

  function addChatLine(who, message) {
    document.getElementById(replyBoxId).value = document.getElementById(replyBoxId).value + "\n" + who + " : " + message;
  }

  function peersChangedCallback(object) {
    //print( object, 'cordova' );
    nslog("*** no. of peers = " + object.length + " ***");
    // [ { peerIdentifier: '78109D58-68A9-447A-8967-16A918727902', peerName: 'TED-iPhone6+', peerAvailable: true } ]

    // clear the old list first
    document.getElementById(peerListSelectorId).innerHTML = "";

    // add peers to list
    for (var i=0; i<length; i++) {
      addButton(object[i]);
    }

    if (document.getElementById(remAddrBoxId).value.length > 0) {
      document.getElementById(myRemoteDeviceId).style.display = 'block';
      document.getElementById(myDeviceSelectionId).style.display = 'none';
    } else {
      document.getElementById(myRemoteDeviceId).style.display = 'none';
      document.getElementById(myDeviceSelectionId).style.display = 'block';
    }
  }

  // not used with iOS - iOS triggers registerToNative calls
  function peersConnectionStateCallback(peerId, state) {
    alert("Got connection peer : " + peerId + ", state: "  + state);
  }
  function peerClientConnectionCallback(peerId) {
    nslog("cor peerClientConnectionCallback : " + peerId); // <--@

    document.getElementById(myRemoteDeviceId).style.display = 'block';
  }
  function peerServerConnectionCallback(peerId) {
    nslog("cor peerServerConnectionCallback : " + peerId); // <--@

    document.getElementById(myRemoteDeviceId).style.display = 'block';
  }

  function addButton(peer) {
        var butEntries = document.getElementById(peerListSelectorId);

        if (butEntries) {
            var holdingdiv = document.createElement('div');
            var hrelem1 = document.createElement('hr');
            holdingdiv.appendChild(hrelem1);

            print(peer, "addButton");
            nslog("peerAvailable:" + peer.peerAvailable + " id:" + peer.peerIdentifier);

            // (peer.peerAvailable == "true")
            if (peer.peerAvailable == true) {
                var button = document.createElement('button');
                button.innerHTML = 'Connect to ' + peer.peerName;
                button.onclick = function () {
                    connectToDevice(peer.peerIdentifier);
                    return false;
                };

                holdingdiv.appendChild(button);
            } else {
                var statediv = document.createElement('div');
                statediv.innerHTML = peer.peerName + " Unavailable, id: " + peer.peerIdentifier;

                holdingdiv.appendChild(statediv);
            }

            var hrelem2 = document.createElement('hr');
            holdingdiv.appendChild(hrelem2);

            butEntries.appendChild(holdingdiv);
        }
    }

    function connectToDevice(peerId) {
      if (peerId.length > 0) {
        nslog("connectToDevice:" + peerId);
        jxcore('Connect').call(peerId, connectCallback);
      } else {
        alert("No device selected to connect to");
      }
    }

    function connectCallback(status, errorString) {
        if (errorString.length > 0) {
            alert("Connection " + status + ", details: " + errorString);
        }
    }





  //alert('thali_main.js end');


  // jukka
  /*
  var incomingConnection = false;
  //*/


  function logInCordova(message) {
    console.log("logInCordova: " + message);
    var container = document.getElementById(logEntriesId);
    if (container) {
      var div = document.createElement('div');
      div.className = 'logEntry';
      message = message.replace('\n', '<br/>');
      message = message.replace(' ', '&nbsp;');
      div.innerHTML = message;
      container.appendChild(div);
    }
  }

  function clearLogs() {
    document.getElementById(logEntriesId).innerHTML = "";
  }

  //
  // cordova->jxcore helper functions. (shares functions in 'app.js')
  //

  function nslog(message) {
    jxcore('nslog').call(message);
  }

  function print(object, message) {
    jxcore('print').call(object, message);
  }

  console.log("//thali_main.js end");
})();
