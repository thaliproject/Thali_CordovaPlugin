(function () {

    // Per the readme you have to copy sockettest.js from the test directory
    // to the same directory that this file, app.js, is in.
    var sockettest = require("./sockettest.js");
    sockettest.nodeJSTest();

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

    function getFreePort() {
        var freePortNumber;
        cordova('getFreePort').callNative(function (portno) {
            console.log('getFreePort return was ' + portno);
            freePortNumber = portno;
        });
        return freePortNumber;
    };

    var peerIdentifier = getPeerIdentifier();
    var peerName = getDeviceName();


    function isFunction(functionToCheck) {
        var getType = {};
        return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
    }


/*----------------------------------------------------------------------------------
     Start- HTTP related functionality
-----------------------------------------------------------------------------------*/

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
/*----------------------------------------------------------------------------------
End- HTTP related functionality
Start- PouchDB related functionality
 -----------------------------------------------------------------------------------*/

    var express = require('express'),
        app     = express(),
        PouchDB = require('pouchdb');

// Remove powered by
    app.disable('x-powered-by');

// Add postcard database
    app.use('/db', require('express-pouchdb')(PouchDB));
    var db = new PouchDB('postcard');
    var id = new Date().toISOString();

    db.put({
        _id: id,
        message: 'Hello from Thali at ' + id
    }, function (err, doc) {
        console.log(doc);
    });

    app.listen(3000);

    function sync(remoteCouch) {
        console.log("synch databse with : " + remoteCouch);

        var opts = {continuous: true, complete: syncError};
        db.replicate.to(remoteCouch, opts);
        db.replicate.from(remoteCouch, opts);
    }
    function syncError(err) {
        console.log(err);
    }

    function replicate(remoteCouch) {
        console.log("replicate databse with : " + remoteCouch);

        var rep = PouchDB.replicate('postcard',remoteCouch, {
            live: true,
            retry: true
        }).on('change', function (info) {
            console.log("-**-remoteCouch : change, "  + info);
        }).on('paused', function () {
            console.log("-**-remoteCouch : paused");
        }).on('active', function () {
            console.log("-**-remoteCouch : active");
        }).on('denied', function (info) {
            console.log("-**-remoteCouch : denied, " + info);
        }).on('complete', function (info) {
            console.log("-**-remoteCouch : complete, " + info);
        }).on('error', function (err) {
            console.log("-**-remoteCouch : error, " + err);
        });
    }


/*----------------------------------------------------------------------------------
     End- PouchDB related functionality
 -----------------------------------------------------------------------------------*/

/*
Helper functions
 */

// Starts peer communications.
    function startPeerCommunications(peerIdentifier, peerName) {
        var result;
        // find free port we can use for the HTTP server
        var serverport = getFreePort();

        cordova('StartPeerCommunications').callNative(peerIdentifier, peerName, serverport, function (value) {
            result = Boolean(value);
            console.log("StartPeerCommunications returned : " + result);
            if (result) {
                console.log(" server listens port :" + serverport);
                //start HTTP server for incoming queries
                closeServerHandle = 0;
                server.listen(serverport);
            }
        });
        return result;
    };

// Connect to the device.
    function ConnectToDevice(address) {
        cordova('ConnectToDevice').callNative(address, function () {
            console.log("ConnectToDevice called");
        });
    };

// Connect to the device.
    function DisconnectPeer(address) {
        cordova('DisconnectPeer').callNative(address, function () {
            console.log("DisconnectPeer callback with " + arguments.length + " arguments");
        });
    };

// Stops peer communications.
    function stopPeerCommunications(peerIdentifier, peerName) {
        cordova('StopPeerCommunications').callNative(function () {
        });

        if (closeServerHandle != 0) {
            closeServerHandle.close();
            closeServerHandle = 0;
        }
    }


// inform connection status.
    function peerConnectionStateChanged(peerIdentifier, state) {

        console.log("peerConnectionStateChanged " + peerIdentifier + " to  state " + state);
        if (isFunction(peerConnectionStatusCallback)) {
            peerConnectionStatusCallback(peerIdentifier, state);
        } else {
            console.log("peerConnectionStatusCallback not set !!!!");
        }
    }




 /*
 Registred native functions for conenctivity & peers change events
 */

// Register peerGotConnection callback.
    cordova('peerGotConnection').registerToNative(function (peerId, port) {
        console.log('peerAvailabilityChanged called with port : ' + port);

        //inform the UI of the connectivity change
        peerConnectionStateChanged(peerId, "peerGotConnection");

    });


// Register peerConnected callback.
    cordova('peerConnected').registerToNative(function (peerId, port) {
        console.log('peerAvailabilityChanged called with port:' + port);
        httpRequestport = port;
        peerConnectionStateChanged(peerId, "Connected");

    });

    // Register peerNotConnected callback.
    cordova('peerNotConnected').registerToNative(function (peerId) {
        console.log('peerAvailabilityChanged called');

        peerConnectionStateChanged(peerId, "Disconnected");
    });

    // Register peerConnecting callback.
    cordova('peerConnecting').registerToNative(function (peerId) {
        console.log('peerAvailabilityChanged called');

        peerConnectionStateChanged(peerId, "Connecting");
    });

    // Register peerAvailabilityChanged callback.
    cordova('peerAvailabilityChanged').registerToNative(function (args) {
        console.log('peerAvailabilityChanged called');
        var peers = args[0];

        console.log("peerChanged " + peers);
        if (isFunction(peerChangedCallback)) {
            peerChangedCallback(args);
        } else {
            console.log("peerChangedCallback not set !!!!");
        }
    });

    /*
     other Registred native functions
     */

    cordova('networkChanged').registerToNative(function (args) {
        console.log('networkChanged called');
        var network = args[0];
        console.log(JSON.stringify(network));

        if (network.isReachable) {
            console.log('****** NETWORK REACHABLE!!!');
        }

    });

    var isInForeground = false;

    cordova('onLifeCycleEvent').registerToNative(function (message) {
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
        console.log("SynchDBNow Called");
        sync("/localhost:" + httpRequestport + "/postcard");
        //sync("http://localhost:" + httpRequestport + "/");
    });

    cordova('ReplicateDBNow').registerAsync(function(callback){
        console.log("ReplicateDBNow called");

        replicate("/localhost:" + httpRequestport + "/postcard");
        //'http://127.0.0.1:5984/postcard'
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

    /*
     Debug stuff
     */
    cordova('OnMessagingEvent').registerToNative(function (message) {
        console.log("On-MessagingEvent:" + arguments.length + " arguments : msg: " + message);

        if (isFunction(MessageCallback)) {
            MessageCallback(message);
        } else {
            console.log("MessageCallback not set !!!!");
        }
    });


    // Log that the app.js file was loaded.
    console.log('ThaliMobile app.js loaded');

})();