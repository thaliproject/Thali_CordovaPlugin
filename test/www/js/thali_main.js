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
            //logInCordova('JXcore ready');
            // Load app.js.
            jxcore('app.js').loadMainFile(function (ret, err) {
                if (err) {
                    alert('Error loading ThaliMobile app.js');
                    alert(err);
                } else {
                    jxcore_ready();
                }
            });
        });
    }, 10);


    function jxcore_ready() {

        document.getElementById("startButton").addEventListener("click", startConnector);
        document.getElementById("stopButton").addEventListener("click", stopConnector);
        document.getElementById("SendButton").addEventListener("click", SendMessage);
        document.getElementById("ClearMessagesButton").addEventListener("click", ClearMessages);
        document.getElementById("DisconnectButton").addEventListener("click", DisconnectPeer);
    }


    function startConnector() {
        jxcore('setMessageCallback').call(SendMessageCallback);
        jxcore('setConnectionStatusCallback').call(peersConnectionStateCallback);
        jxcore('setPeerChangedCallback').call(peersChangedCallback);

        document.getElementById('stopButton').style.display = 'block';
        document.getElementById('startButton').style.display = 'none';
    }

    function stopConnector() {

        jxcore('StopConnector').call(peersChangedCallback);

        document.getElementById('stopButton').style.display = 'none';
        document.getElementById('startButton').style.display = 'block';
        document.getElementById('myRemoteDevice').style.display = 'none';
        document.getElementById('myDeviceSelection').style.display = 'none';
    }

// Peers that we know about.
    var _peers = {};

    function peersChangedCallback(myJson) {

        //  alert("Got myJson :" + myJson);

        for (var i = 0; i < myJson.length; i++) {
            var peer = myJson[i];
            _peers[peer.peerIdentifier] = peer;
//        alert("Got peer : " + peer.peerIdentifier + ", peerAvailable: "  + peer.peerAvailable);
        }

        //Lets clear the old list first
        var butEntries = document.getElementById('peerListSelector');
        butEntries.innerHTML = "";

        // on top of the list shown we have the available peers
        for (var key in _peers) {
            if (_peers[key].peerAvailable == "true") {
                addButton(_peers[key]);
            }
        }
        // and on bottom we have the non-available peers
        for (var key in _peers) {
            if (_peers[key].peerAvailable != "true") {
                addButton(_peers[key]);
            }
        }

        if (document.getElementById('RemAddrBox').value.length > 0) {
            document.getElementById('myRemoteDevice').style.display = 'block';
            document.getElementById('myDeviceSelection').style.display = 'none';
        } else {
            document.getElementById('myRemoteDevice').style.display = 'none';
            document.getElementById('myDeviceSelection').style.display = 'block';
        }
    }

    var incomingConnection = false;

    function peersConnectionStateCallback(peerId, state) {

        // alert("Got connection peer : " + peerId + ", state: "  + state);

        if (state == "Disconnected") {
            document.getElementById('RemNameBox').value = "";
            document.getElementById('RemAddrBox').value = "";
            ClearMessages();
        } else if (state == "Connected") {
            incomingConnection = false;
            document.getElementById('RemAddrBox').value = peerId;
            for (var key in _peers) {
                if (_peers[key].peerIdentifier == peerId) {
                    document.getElementById('RemNameBox').value = _peers[key].peerName;
                }
            }
        }

        if (document.getElementById('RemAddrBox').value.length > 0) {
            if (incomingConnection == true) {
                document.getElementById('mySendMessageDiv').style.display = 'none';
            } else {
                document.getElementById('mySendMessageDiv').style.display = 'block';
            }

            document.getElementById('myRemoteDevice').style.display = 'block';
            document.getElementById('myDeviceSelection').style.display = 'none';
        } else {
            document.getElementById('myRemoteDevice').style.display = 'none';
            document.getElementById('myDeviceSelection').style.display = 'block';
        }
    }

    function addButton(peer) {

        var butEntries = document.getElementById('peerListSelector');

        if (butEntries) {
            var holdingdiv = document.createElement('div');
            var hrelem1 = document.createElement('hr');
            holdingdiv.appendChild(hrelem1);

            if (peer.peerAvailable == "true") {
                var button = document.createElement('button');
                button.innerHTML = 'Connect to ' + peer.peerName;
                button.onclick = function () {
                    ConnectToDevice(peer.peerIdentifier);
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

    function DisconnectPeer() {
        jxcore('DisconnectPeer').call("", ConnectCallback);
    }

    function ConnectToDevice(peerid) {

        if (peerid.length > 0) {
            jxcore('ConnectToDevice').call(peerid, ConnectCallback);
        } else {
            alert("No device selected to connect to");
        }
    }

    function ConnectCallback(status, errorString) {
        if (errorString.length > 0) {
            alert("Connection " + status + ", details: " + errorString);
        }
    }

    function addChatLine(who, message) {
        document.getElementById('ReplyBox').value = document.getElementById('ReplyBox').value + "\n" + who + " : " + message;
    }

    function ClearMessages() {
        document.getElementById('ReplyBox').value = "";
    }

    function SendMessageCallback(data) {
        console.log("SendMessageCallback " + data);

        if (data.readMessage) {
            addChatLine(document.getElementById('RemNameBox').value, data.readMessage);
        } else if (data.writeMessage) {
            addChatLine("ME", data.writeMessage);
        } else {
            addChatLine(document.getElementById('RemNameBox').value, data);
        }
    }
    function SendMessage() {
        var message = document.getElementById('MessageBox').value;

        jxcore('SendMessage').call(message, SendMessageCallback);

        addChatLine("ME", message);
        document.getElementById('MessageBox').value = ""
    }

})();
