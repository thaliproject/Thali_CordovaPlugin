(function () {

    /*
     Helper functions and variables
     */

    // Gets the device name.
    function getDeviceName() {
        var deviceNameResult;
        cordova('GetDeviceName').callNative(function (deviceName) {
            console.log('GetDeviceName return was ' + deviceName);
            deviceNameResult = deviceName;
        });
        return deviceNameResult;
    };

    // Gets the peer identifier.
    function getPeerIdentifier() {
        var _peerIdentifierKey = 'PeerIdentifier';
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

    function getFreePort(callback) {

        cordova('GetFreePort').callNative(function (portno) {
            console.log('getFreePort return was ' + portno);
            callback(portno);
        });
    };

    var peerIdentifier = getPeerIdentifier();
    var peerName = getDeviceName();


    function isFunction(functionToCheck) {
        var getType = {};
        return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
    }


/*----------------------------------------------------------------------------------
     Start- HTTP related functionality
-----------------------------------------------------------------------------------

    var http = require("http");
    var server = http.createServer(function (request, response) {

        console.log('HTTP request called : ' + request.method);
        console.log(request.headers);

        var urlDecoded = decodeURIComponent(request.url);

        if (request.method.localeCompare("GET") == 0) {

        } else {
            gotMessage(request.body);
        }

        response.writeHead(200, {"Content-Type": "text/html"});
        response.write("<!DOCTYPE \"html\">");
        response.write("<html>");
        response.write("<head>");
        response.write("<title>Hello World Page</title>");
        response.write("</head>");
        response.write("<body>");
        response.write("Hello from " + peerName + ", my id is: " + peerIdentifier);
        response.write("Url fetched : " + request.url);
        response.write("</body>");
        response.write("</html>");
        response.end();

        console.log("response sent");

        gotMessage("request url:" + urlDecoded);

    });

    var closeServerHandle = 0;
    server.on("listening", function () {
        console.log("server is listening");
        closeServerHandle = server;
    });


    function sendGetRequest(message) {

        var options = {
            path: '/' + encodeURIComponent('data?message=' + message),
            port: httpRequestport,
            method: 'GET',
            headers: {
                accept: 'application/json',
                connection: 'close'
            }
        };

        var replydata = "";

        console.log("sendRequest now to: " + httpRequestport);
        var x = http.request(options, function (res) {
            console.log("Connected");
            res.on('data', function (data) {
                console.log("Request reply Data " + data);
                replydata = replydata + data;
            });
            res.on('end', function () {
                console.log("Request ended");
                gotMessage(replydata);
                replydata = "";
            });
        });
        x.end();
    }
    */
/*----------------------------------------------------------------------------------
End- HTTP related functionality
Start- TCP/IP related functionality
 -----------------------------------------------------------------------------------*/
    // var sockettest = require('./sockettest');

    var net = require('net');

    var server = 0;
    function startServerSocket(port) {

        if(server != 0){
            server.close();
            server = 0;
        }

        server = net.createServer(function (c) { //'connection' listener
             console.log('TCP/IP server connected');
             peerConnectionStateChanged("debug","peerGotConnection");

             c.on('end', function () {
                console.log('TCP/IP server is ended');
            });
            c.on('close', function () {
                console.log('TCP/IP server is close');
              //  peerConnectionStateChanged("debug","Disconnected");
            });
            c.on('error', function (err) {
                console.log('TCP/IP server got error : ' + err);
        //      peerConnectionStateChanged("debug","Disconnected");
            });

             c.on('data', function (data) {
                 // BUGBUG: On the desktop this event listener is not necessary. But on JXCore on Android
                 // we have to include this handler or no data will ever arrive at the server.
                 // Please see https://github.com/jxcore/jxcore/issues/411
                 console.log("We received data on the socket the server is listening on - " + data.toString());
                 gotMessage("data: " + data.toString());
                 c.write("Got data : " + data.toString());
             });

            // c.pipe(c);
         });

        server.on('error', function (data) {
            console.log("serverSocket error: " + data.toString());
       //     peerConnectionStateChanged("debug","Disconnected");
        });
        server.on('close', function () {
          //  peerConnectionStateChanged("debug","Disconnected");
            console.log('server socket is disconnected');
        });

         server.listen(port, function() { //'listening' listener
             console.log('server is bound to : ' + port);
         });
     }

    var clientSocket = 0;
    function startClientSocket(port) {
        if(clientSocket != 0) {
            clientSocket.end();
            clientSocket = 0;
        }
        clientSocket = net.connect(port, function () { //'connect' listener
            peerConnectionStateChanged("debug","Connected");
            console.log("We have successfully connected to the server.");
        });
        clientSocket.on('data', function (data) {
            console.log("clientSocket got data: " + data.toString());
            gotMessage("data: " + data.toString());
        });
        clientSocket.on('close', function () {
            // peerConnectionStateChanged("debug","Disconnected");
            console.log('clientSocket is closed');
        });
    }
    function sendGetRequest(message) {
        clientSocket.write(message);
    }

    function closeSockets() {
        if(clientSocket != 0){
            clientSocket.end();
            clientSocket = 0;
        }
        if(server != 0){
            server.close();
            server = 0;
        }
    }


        /*----------------------------------------------------------------------------------
         End- TCP/IP related functionality
         -----------------------------------------------------------------------------------*/

        /*
         Helper functions
         */

// Starts peer communications.
//
    function startPeerCommunications(peerIdentifier, peerName) {
            
            // find free port we can use for the HTTP server
        getFreePort(function (serverport){
            console.log(" server listens port :" + serverport);
                startServerSocket(serverport);;

                cordova('StartBroadcasting').callNative(peerIdentifier, peerName, serverport, function (err) {
                    console.log("StartPeerCommunications returned : " + err + ", port: " + port);
                    if (err != null && err.length > 0) {
                        cordova('ShowToast').callNative("Can not Start boardcasting: " + err, true, function () {
                            //callback(arguments);
                        });
                    }
                })
        });
    };

// Connect to the device.
    function ConnectToDevice(address) {
        cordova('Connect').callNative(address, function (err, port) {
            console.log("ConnectToDevice called with port " + port + ", error: " + err);

            if (err != null && err.length > 0) {
                cordova('ShowToast').callNative("Can not Connect: " + err, true, function () {
                    //callback(arguments);
                });
            }else if (port > 0){
                console.log("Starting client socket at : " + port);
                startClientSocket(port);
            }
        });
    };

    /**
     * Jukka debug helper -start
     */
    cordova('GotIncomingConnection').registerToNative(function (peerId) {
        console.log('GotIncomingConnection called with peer id: ' + peerId);

        cordova('Connect').callNative(peerId, function (err, port) {
            console.log("ConnectToDevice called with port " + port + ", error: " + err);

            if (err != null && err.length > 0) {
                cordova('ShowToast').callNative("Can not Connect: " + err, true, function () {
                    //callback(arguments);
                });
            }else if (port > 0){
                startClientSocket(port);
            }
        });
    });
    /**
     * Jukka debug helper -end
     */

// Connect to the device.
    function DisconnectPeer(address) {

        //debug stuff
        peerConnectionStateChanged("debug","Disconnected");
    // debug time I use "" as peer address, it disconnects al
        cordova('Disconnect').callNative("", function (err) {
            console.log("DisconnectPeer callback with err: " + err);

            if(clientSocket != 0) {
                clientSocket.end();
                clientSocket = 0;
            }
        });
    };

// Stops peer communications.
    function stopPeerCommunications(peerIdentifier, peerName) {
        cordova('StopBroadcasting').callNative(function () {
        });

        closeSockets();
    };


// inform connection status, helpper for debug
    function peerConnectionStateChanged(peerIdentifier, state) {

        if (isFunction(peerConnectionStatusCallback)) {
            console.log("peerConnectionStateChanged " + peerIdentifier + " to  state " + state);
            peerConnectionStatusCallback(peerIdentifier, state);
        } else {
            console.log("peerConnectionStatusCallback not set !!!!");
        }
    };


    /*
     Registred event handlers
     */

// Register peerAvailabilityChanged callback.
    cordova('peerAvailabilityChanged').registerToNative(function (args) {
        console.log('peerAvailabilityChanged called');

        if (isFunction(peerChangedCallback)) {
            peerChangedCallback(args);
        } else {
            console.log("peerChangedCallback not set !!!!");
        }
    });

    cordova('networkChanged').registerToNative(function (args) {
        console.log('networkChanged called');
        var network = args[0];
        console.log(JSON.stringify(network));

        if (network.isReachable) {
            console.log('****** NETWORK REACHABLE!!!');
        }
        if(network.isWiFi){
            console.log('****** WIFI is on!!!');
        }

    });




    /*
     funtions for Cordova app usage
     */
    var MessageCallback;

    function gotMessage(message) {
        console.log("gotMessage : " + message);

        if (isFunction(MessageCallback)) {
            MessageCallback(message);
        } else {
            console.log("MessageCallback not set !!!!");
        }
    }

    cordova('SendMessage').registerAsync(function (message, callback) {
        console.log("SendMessage : " + message);
        sendGetRequest(message);
    });

    cordova('SynchDBNow').registerAsync(function(callback){
        console.log("SynchDBNow  not implemented yet");
    });

    cordova('ReplicateDBNow').registerAsync(function(callback){
        console.log("ReplicateDBNow not implemented yet");
    });



    cordova('setMessageCallback').registerAsync(function (callback) {
        console.log("setMessageCallback  : " + callback);
        MessageCallback = callback;
    });


    var peerConnectionStatusCallback;
    cordova('setConnectionStatusCallback').registerAsync(function (callback) {
        console.log("setConnectionStatusCallback  : " + callback);
        peerConnectionStatusCallback = callback;
    });

    var peerChangedCallback;

    cordova('setPeerChangedCallback').registerAsync(function (callback) {
        console.log("setConnectionStatusCallback  : " + callback);
        peerChangedCallback = callback;
    });


    cordova('StartConnector').registerAsync(function () {
        console.log("StartConnector: ");
        startPeerCommunications(peerIdentifier, peerName);
    });

    cordova('StopConnector').registerAsync(function () {
        console.log("StopConnector called");
        stopPeerCommunications(peerIdentifier, peerName);
    });

    cordova('ConnectToDevice').registerAsync(function (address, callback) {
        console.log("ConnectToDevice address : " + address);
        ConnectToDevice(address);
    });

    cordova('DisconnectPeer').registerAsync(function (address, callback) {
        console.log("DisconnectPeer address : " + address);
        DisconnectPeer(address);
    });


    cordova('ShowToast').registerAsync(function (message, isLong, callback) {
        cordova('ShowToast').callNative(message, isLong, function () {
            //callback(arguments);
        });
    });


    // Log that the app.js file was loaded.
    console.log('ThaliMobile app.js loaded');

})();