(function () {


/*----------------------------------------------------------------------------------
TCP/IP server side handling code
 -----------------------------------------------------------------------------------*/

    var net = require('net');

    var server = 0;
    function startServerSocket(port) {

        if(server != 0){
            server.close();
            server = 0;
        }

        server = net.createServer(function (c) { //'connection' listener
             console.log('TCP/IP server connected');

             c.on('end', function () {
                console.log('TCP/IP server is ended');
            });
            c.on('close', function () {
                console.log('TCP/IP server is close');
            });
            c.on('error', function (err) {
                console.log('TCP/IP server got error : ' + err);
            });

             c.on('data', function (data) {
                 // BUGBUG: On the desktop this event listener is not necessary. But on JXCore on Android
                 // we have to include this handler or no data will ever arrive at the server.
                 // Please see https://github.com/jxcore/jxcore/issues/411
                 console.log("We received data on the socket the server is listening on - " + data.toString());
                 gotMessage("data: " + data.toString());
                 c.write("Got data : " + data.toString());
             });

            // when using piping, I don't get 'data' events, and as in debug time I want to log them
            // I'm doing write operations in the data event, instead doing the piping
            // c.pipe(c);
         });

        server.on('error', function (data) {
            console.log("serverSocket error: " + data.toString());
        });
        server.on('close', function () {
            console.log('server socket is disconnected');
        });

         server.listen(port, function() { //'listening' listener
             console.log('server is bound to : ' + port);
         });
     }

/*----------------------------------------------------------------------------------
TCP/IP Client socket side handling code
-----------------------------------------------------------------------------------*/

    var clientSocket = 0;
    function startClientSocket(port,tmpAddress) {
        if(clientSocket != 0) {
            clientSocket.end();
            clientSocket = 0;
        }

        clientSocket = net.connect(port, function () { //'connect' listener
            peerConnectionStateChanged(tmpAddress,"Connected");
            console.log("We have successfully connected to the server.");
        });
        clientSocket.on('data', function (data) {
            console.log("clientSocket got data: " + data.toString());
            gotMessage("data: " + data.toString());
        });
        clientSocket.on('close', function () {
            peerConnectionStateChanged(tmpAddress,"Disconnected");
            console.log('clientSocket is closed');
        });

        clientSocket.on('error', function(ex) {
            console.log("clientSocket got error : " + ex);
            // we got error, the close should follow automatically.
            // DisconnectPeer(tmpAddress);
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
    
 /****************************************************************************************
 Functions using the native methods
 ****************************************************************************************/

    function startPeerCommunications(peerName) {

        // start server with port zero so it will get new port for us.
        startServerSocket(0);

        serverport = server.address().port;
        console.log(" server listens port :" + serverport);

        Mobile('StartBroadcasting').callNative(peerName, serverport, function (err) {
            console.log("StartPeerCommunications returned : " + err + ", port: " + port);
            if (err != null && err.length > 0) {
                console.log("Can not Start boardcasting: " + err);
            }
        });
    };

// Connect to the device.
    function ConnectToDevice(address) {

        var tmpAddress = address;
        Mobile('Connect').callNative(address, function (err, port) {
            console.log("ConnectToDevice called with port " + port + ", error: " + err);

            if (err != null && err.length > 0) {
                console.log("Can not Connect: " + err);
            }else if (port > 0){
                console.log("Starting client socket at : " + port);

                // start client socket which will be then connected by native code;
                startClientSocket(port,tmpAddress);
            }
        });
    };


// Connect to the device.
    function DisconnectPeer(address) {

        // with -1 story we actually use disconnect, not dsconnect by socket
        // but with zero we are definerely haing this, thus we should have both
        // disconnect by TCP client socket closing as well as by Disconnect method
        if(clientSocket != 0){
            console.log("Disconnect clientSocket now.");
            clientSocket.end();
            clientSocket = 0;
        }
/*
    // debug time I use "" as peer address, it disconnects all,
        Mobile('Disconnect').callNative("", function (err) {
            console.log("DisconnectPeer callback with err: " + err);

            if(clientSocket != 0) {
                clientSocket.end();
                clientSocket = 0;
            }
        });*/
    };

// Stops peer communications.
    function stopPeerCommunications() {
        Mobile('StopBroadcasting').callNative(function () {
        });
        closeSockets();
    };

/****************************************************************************************
     Registred event handlers
****************************************************************************************/

// Register peerAvailabilityChanged callback.
    Mobile('peerAvailabilityChanged').registerToNative(function (args) {
        console.log('peerAvailabilityChanged called');

        // peer list is handled in cordova app, so we simply forward it there
        if (isFunction(peerChangedCallback)) {
            peerChangedCallback(args);
        } else {
            console.log("peerChangedCallback not set !!!!");
        }
    });

    Mobile('networkChanged').registerToNative(function (args) {
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


/***************************************************************************************
     functions for Cordova side application usage only
 ***************************************************************************************/

function isFunction(functionToCheck) {
    var getType = {};
    return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}

// simply used to update UI in connected state vs. non-connected
    function peerConnectionStateChanged(peerIdentifier, state) {

        if (isFunction(peerConnectionStatusCallback)) {
            console.log("peerConnectionStateChanged " + peerIdentifier + " to  state " + state);
            peerConnectionStatusCallback(peerIdentifier, state);
        } else {
            console.log("peerConnectionStatusCallback not set !!!!");
        }
    };
    var MessageCallback;

    function gotMessage(message) {
        console.log("gotMessage : " + message);

        if (isFunction(MessageCallback)) {
            MessageCallback(message);
        } else {
            console.log("MessageCallback not set !!!!");
        }
    }

    Mobile('SendMessage').registerAsync(function (message, callback) {
        console.log("SendMessage : " + message);
        sendGetRequest(message);
    });

    Mobile('setMessageCallback').registerAsync(function (callback) {
        console.log("setMessageCallback  : " + callback);
        MessageCallback = callback;
    });


    var peerConnectionStatusCallback;
    Mobile('setConnectionStatusCallback').registerAsync(function (callback) {
        console.log("setConnectionStatusCallback  : " + callback);
        peerConnectionStatusCallback = callback;
    });

    var peerChangedCallback;

    Mobile('setPeerChangedCallback').registerAsync(function (callback) {
        console.log("setConnectionStatusCallback  : " + callback);
        peerChangedCallback = callback;
    });


    Mobile('StartConnector').registerAsync(function (name) {
        console.log("StartConnector: ");
        startPeerCommunications(name);
    });

    Mobile('StopConnector').registerAsync(function () {
        console.log("StopConnector called");
        stopPeerCommunications();
    });

    Mobile('ConnectToDevice').registerAsync(function (address, callback) {
        console.log("ConnectToDevice address : " + address);
        ConnectToDevice(address);
    });

    Mobile('DisconnectPeer').registerAsync(function (address, callback) {
        console.log("DisconnectPeer address : " + address);
        DisconnectPeer(address);
    });
    
    // Log that the app.js file was loaded.
    console.log('ThaliMobile app.js loaded');

})();