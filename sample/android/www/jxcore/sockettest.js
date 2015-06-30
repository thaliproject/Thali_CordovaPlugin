"use strict";

// A workaround for https://github.com/jxcore/jxcore/issues/415 that breaks Bluebird
global.self = global;

var net = require('net');
var randomstring = require('randomstring');
var Promise = require('bluebird');
var multiplex = require('multiplex');

// BUGBUG - This is really just one time use test code but I really should change the code to close the server and
// client socket to use the bluebird using/disposer pattern.

// Server

// The server is basically just an implementation of echo. Anything it receives on the input it will send back on
// the output.
exports.startSocketServer = function(port) {
    var server = net.createServer(function(incomingClientSocket) {
        console.log("We have a incomingClientSocket connection!");

        incomingClientSocket.on('error', function(err) {
            console.log("We got an error on incomingClientSocket connection - " + err);
        });

        incomingClientSocket.on('end', function() {
            console.log("We lost a incomingClientSocket connection.");
        });

        incomingClientSocket.on('data', function(data) {
            console.log("We got data on the server side - " + data);
        });

        incomingClientSocket.pipe(incomingClientSocket);
    });

    server.listen(port);

    return server;
};

// Client

/*
 The client will send out a series of randomly generated messages. It will then check if it gets
 back the same messages from the server.
 */

function rejectWithRetryError(reject, message, shouldRetry) {
    var error = new Error(message);
    error.shouldRetry = shouldRetry;
    reject(error);
}

function failDueToBadInput(testMessage, currentMessage, clientSocket, reject) {
    console.log("TEST FAILED! FAILED! FAILED!");
    console.log("We expected the message: " + testMessage);
    console.log("But we got: " + currentMessage);
    clientSocket.destroy();
    rejectWithRetryError(reject, "Unrecoverable error!", false);
}

function testMessageState(testMessage, currentMessage, clientSocket, resolve, reject) {
    if (currentMessage.length < testMessage.length) {
        return false; // We have a timeout that will catch if we never get any additional data.
    }

    if (currentMessage.length > testMessage.length) {
        failDueToBadInput(testMessage, currentMessage, clientSocket, reject);
        return false;
    }

    if (currentMessage.length == testMessage.length) {
        if (currentMessage == testMessage) {
            console.log("Test Passed!");
            resolve(true);
            return true;
        } else {
            failDueToBadInput(testMessage, currentMessage, clientSocket, reject);
            return false;
        }
    }
}


function socketClientTest(getServerPortFunction, messageSize) {
    return new Promise(function(resolve, reject) {
        getServerPortFunction().then(function(serverPort) {
            // This deals with an edge case I'm not sure even exists. It's theoretically possible that we get an 'end' or
            // other error event on the client socket and so initiate a retry. But our clientSocket.destroy() call might
            // not get completely processed before another event (such as error followed by close) gets run on the
            // same clientSocket and now we'll retry twice! This guards against that.
            var retryAttempted = false;

            function restartIfTestNotPassed(testPassed, message, clientSocket, reject) {
                // It's very difficult to know for sure when the current thread will lose control since we call into
                // functions like destroy and rejectWithRetryError that do things like throw exceptions that can
                // potentially cause odd changes in thread control. So we make sure to set retryAttempted to true
                // before doing anything "interesting" to make we have set up effectively a locked section that
                // will make sure that we only retry any particular attempt exactly once. In other words even if the
                // restartIfTestNotPassed function on the same instance of socketClientTest is called multiple times
                // by different event listeners we are guaranteed that one and only one call will result in a retry.
                // This only works, btw, because Javascript is single threaded.
                if (!testPassed && !retryAttempted) {
                    retryAttempted = true;
                    clientSocket.destroy();
                    rejectWithRetryError(reject, message, true);
                }
            }

            var testMessage = randomstring.generate(messageSize);
            var testPassed = false;

            var clientSocket = net.createConnection( { port: serverPort }, function() {
                console.log("We have successfully connected to the server.");
                clientSocket.write(testMessage);
            });

            clientSocket.setTimeout(120000);

            clientSocket.setKeepAlive(true);

            var currentMessage = "";

            clientSocket.on('data', function(data) {
                console.log("We have received the following data from the server - " + data);
                currentMessage += data;
                testPassed = testMessageState(testMessage, currentMessage, clientSocket, resolve, reject);
            });

            clientSocket.on('end', function() {
                restartIfTestNotPassed(testPassed, "End before Passing", clientSocket, reject);
            });

            clientSocket.on('timeout', function() {
                restartIfTestNotPassed(testPassed, "Timeout before Passing", clientSocket, reject);
            });

            clientSocket.on('error', function() {
                restartIfTestNotPassed(testPassed, "Error before Passing", clientSocket, reject);
            });

            clientSocket.on('close', function() {
                restartIfTestNotPassed(testPassed, "Close before Passing", clientSocket, reject);
            });
        }).catch(function(err) {
            console.log("socketClientTest-Catch for call to getServerPortFunction with error - " + err);
        });
    });
}

function manageMessagePasses(getServerPortFunction, messageSize, remainingPasses) {
    if (remainingPasses > 0) {
        return Promise.resolve()
            .then(function() {
                return socketClientTest(getServerPortFunction, messageSize)
                    .then(function() {
                        return manageMessagePasses(getServerPortFunction, messageSize, remainingPasses - 1);
                    });
            }).catch(function(error) {
                if (error.hasOwnProperty("shouldRetry") && error.shouldRetry) {
                    console.log("About to retry because of: " + error);
                    return manageMessagePasses(getServerPortFunction, messageSize, remainingPasses);
                } else {
                    throw error;
                }
            });
    } else {
        return true;
    }
}

exports.startSocketClient = function(getServerPortFunction) {
    var messageSize = 200;
    var maxPasses = 1;
    return manageMessagePasses(getServerPortFunction, messageSize, maxPasses);
};

// Test

// This is just for internal testing. The "real" test with the discovery and high bandwidth P2P frameworks
// need to pass in a proper getServerPortFunction.
exports.nodeJSTest = function() {
    var serverPort = 9998;
    var server = exports.startSocketServer(serverPort);
    return testSuccessOrFailure(function () {
        return Promise.resolve(serverPort);
    });
};

function tcpProxyServer(port, serverPlex) {
    var server = net.createServer(function(incomingClientSocket) {
        console.log("We have a incomingClientSocket connection!");

        incomingClientSocket.on('end', function() {
            console.log("We lost a incomingClientSocket connection.");
        });

        incomingClientSocket.on('data', function(data) {
            console.log("We got data on the server side - " + data);
        });

        incomingClientSocket.pipe(serverPlex).pipe(incomingClientSocket);
    });

    server.listen(port);

    return server;
}

function cleanUpSocket(socket, cleanUpCallBack) {
    var triedToClose = false;

    socket.on('end', function() {
        console.log("We got an end on incomingClientsocket");
        cleanUpCallBack();
        triedToClose = true;
    });

    socket.on('error', function() {
        console.log("We got an error on incomingclientsocket!");
        cleanUpCallBack();
        triedToClose = true;
    });

    socket.on('close', function() {
        console.log("We lost a incomingClientSocket connection.");
        if (!triedToClose) {
            cleanUpCallBack();
            triedToClose = true;
        }
    });
}

function listenForStreamEvents(stream, prefixName) {
    stream.on('error', function(err) {
        console.log(prefixName + " error - " + err);
    });

    stream.on('end', function() {
        console.log(prefixName + " end");
    });

    stream.on('close', function() {
        console.log(prefixName + " close");
    });

    stream.on('data', function(data) {
        console.log(prefixName + "  data  " + data);
    });
}

function muxServerBridge(localP2PTcpServerPort, tcpEndpointServerPort) {
    var serverPlex = multiplex({}, function(stream, id) {
        console.log("Server received stream id " + id);
        var clientSocket = net.createConnection({port: tcpEndpointServerPort});
        stream.pipe(clientSocket).pipe(stream);
        listenForStreamEvents(stream, "muxServerBridge + MuxStream");
        listenForStreamEvents(clientSocket, "muxServerBridge + ClientSocket");
        cleanUpSocket(clientSocket, function() {
            stream.destroy();
        });
        cleanUpSocket(stream, function() {
            clientSocket.destroy();
        });
    });

    var server = net.createServer(function(incomingClientSocket) {
        console.log("We have a incomingClientSocket connection!");
        listenForStreamEvents(incomingClientSocket, "muxServerBridge + incomingClientSocket");
        cleanUpSocket(incomingClientSocket, function() {
            serverPlex.destroy();
            server.close();
        });
        incomingClientSocket.pipe(serverPlex).pipe(incomingClientSocket);
    });

    listenForStreamEvents(server, "muxServerBridge - server");
    cleanUpSocket(server, function() {
        serverPlex.destroy();
        server.close();
    });

    server.listen(localP2PTcpServerPort);

    return server;
}

process.on('uncaughtException', function(err) {
    console.log("Uncaught process exception! - " + err);
});


function muxClientBridge(muxServerPort, localP2PTcpServerPort) {
    var clientPlex = multiplex();
    var clientSocket = net.createConnection({port: localP2PTcpServerPort});
    var incomingTCPConnectionSocketArray = {};
    var socketIdCounter = 0;

    var server = net.createServer(function(incomingClientSocket) {
        console.log("We have a incomingClientSocket connection!");
        var localSocketId = socketIdCounter;
        socketIdCounter += 1;
        incomingTCPConnectionSocketArray[localSocketId] = incomingClientSocket;

        var clientStream = clientPlex.createStream();
        incomingClientSocket.pipe(clientStream).pipe(incomingClientSocket);

        listenForStreamEvents(incomingClientSocket, "muxClientBridge + incomingClientSocket");
        listenForStreamEvents(clientStream, "muxClientBridge + clientStream");
        cleanUpSocket(incomingClientSocket, function() {
            clientStream.destroy();
            delete incomingTCPConnectionSocketArray[localSocketId];
        });
    });

    listenForStreamEvents(clientSocket, "muxClientBridge + clientSocket");
    cleanUpSocket(clientSocket, function() {
        clientPlex.destroy();
        server.close();
        incomingTCPConnectionSocketArray.foreach(function(socketId) {
            incomingTCPConnectionSocketArray[socketId].destroy();
        })
    });
    listenForStreamEvents(server, "muxClientBridge + server");

    server.listen(muxServerPort);

    clientPlex.pipe(clientSocket).pipe(clientPlex);

    return server;
}

exports.multiplexPlusTCPTest = function() {
    var serverPort = 9998;
    var server = exports.startSocketServer(serverPort);

    var localP2PTcpServerPort = 9000;
    muxServerBridge(localP2PTcpServerPort, serverPort);
    var muxServerPort = 9001;
    muxClientBridge(muxServerPort, localP2PTcpServerPort);

    function getServerPortFunction() {
        return Promise.resolve(muxServerPort);
    }

    // This is a test to see if node.js will close the mux client bridge's TCP client
    // connection to the mux Server Bridge's TCP front end server when it is idle for
    // a whole second.
    setTimeout(function() {
        var promises = [
            exports.startSocketClient(getServerPortFunction),
            exports.startSocketClient(getServerPortFunction),
            exports.startSocketClient(getServerPortFunction)];
        Promise.all(promises).then(function() {
            console.log("All tests really and truly did finish!!!!!");
            server.close();
        }).catch(function(err) {
            console.log("Whole test failed because of - " + err);
            server.close();
        })
    }, 1000);

};

/*
 I write to multiplex client stream directly
 client plex ->  tcp/ip client socket -> tcp/ip server socket -> server plex
 */
exports.multiplexTest = function() {
    var serverPort = 9998;
    var clientPlex = multiplex();
    var serverPlex = multiplex({}, function(stream, id) {
        console.log("Server received stream id " + id);
        stream.on('data', function(data) {
            stream.write(data);
        });
    });

    var serverSocket = tcpProxyServer(serverPort, serverPlex);

    var clientSocket = net.createConnection({port: serverPort});

    clientPlex.pipe(clientSocket).pipe(clientPlex);

    var yoDogStream = clientPlex.createStream("Yo Dog!");

    yoDogStream.on('data', function(data) {
        console.log("Client received back data: " + data.toString());
    });

    yoDogStream.write("This is a test");
};

// This is a mock up of what the actual test function for story -1 should look like. It's a mock up because
// the native functions don't actually work yet. But this should give a sense of what things should look like.
// Note that we should wrap the native function calls into promise based wrappers. It would make the code below
// massively more readable. Nested callbacks suck. :(
exports.realTest = function() {
    var serverPort = 9998;
    var server = exports.startSocketServer(serverPort);

    var localP2PTcpServerPort = 9000;
    muxServerBridge(localP2PTcpServerPort, serverPort);

    var peersWeAreTestingAgainst = [];
    console.log("realtest - About to start real test and call StartBroadcasting");
    Mobile('StartBroadcasting').callNative(Date.now().toString(), localP2PTcpServerPort,
        function(err) {
            if (err != null && err.length > 0) {
                throw new Error("Call to StartBroadcasting failed! Error - " + err);
            }

            console.log("realtest - About to call peerAvailabilityChanged");
            Mobile('peerAvailabilityChanged').registerToNative(function(peers) {
                console.log("realtest - Got peers! - " + JSON.stringify(peers));
                peers.forEach(function(peer) {
                    Mobile('realtest - peer: ' + JSON.stringify(peer));
                    if (peer.peerAvailable &&
                        (peersWeAreTestingAgainst.indexOf(peer.peerIdentifier) == -1)) {
                        console.log("realtest - About to push peer id - " + peer.peerIdentifier)
                        peersWeAreTestingAgainst.push(peer.peerIdentifier);
                        console.log("realtest - About to call testSuccessOrFailure.");

                        exports.startSocketClient(function () {
                            return new Promise(function (resolve, reject) {
                                console.log("realtest - About to call connect on peer - " + JSON.stringify(peer));
                                var muxClientBridgeRunning = false;
                                Mobile('Connect').callNative(peer.peerIdentifier,
                                    function (err, port) {
                                        console.log("realtest - Connect called back with - err: " + err + ", port: " + port);
                                        if (err != null && err.length > 0) {
                                            reject("Attempt to get port to connect to remote device failed" +
                                                " because of " + err);
                                        } else if (port == 0) {
                                            reject("Got port == 0 when attempting to connect to peer!");
                                        } else {
                                            var muxServerPort = 9001;
                                            if (!muxClientBridgeRunning)
                                            {
                                                // Obviously this should not be a fixed port since if we have more than one peer we
                                                // need more ports. But for right now this is o.k. because we each only have two
                                                // android devices to test against.
                                                muxClientBridge(muxServerPort, port);
                                                muxClientBridgeRunning = true;
                                            }

                                            resolve(muxServerPort);
                                        }
                                    });
                            });
                        })
                    }
                });
            });
        });
};
