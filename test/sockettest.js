"use strict";

var net = require('net');
var randomstring = require('randomstring');
var Promise = require('bluebird');

// Server

// The server is basically just an implementation of echo. Anything it receives on the input it will send back on
// the output.
exports.startSocketServer = function(port) {
    var server = net.createServer(function(incomingClientSocket) {
        console.log("We have a incomingClientSocket connection!");

        incomingClientSocket.on('end', function() {
            console.log("We lost a incomingClientSocket connection.");
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
        // This deals with an edge case I'm not sure even exists. It's theoretically possible that we get an 'end' or
        // other error event on the client socket and so initiate a retry. But our clientSocket.destroy() call might
        // not get completely processed before another event (such as error followed by close) gets run on the
        // same clientSocket and now we'll retry twice! This guards against that.
        var retryAttempted = false;

        function restartIfTestNotPassed(testPassed, message, clientSocket, reject) {
            // It's very difficult to know for sure when the current thread will lose control since we call into
            // functions like destroy and rejectWithRetryError that do things like throw exceptions that can
            // potentially cause odd changes in thread control. So we make sure to set retryAttempted to true
            // before doing anything "interesting" to make sure we have set up effectively a locked section that
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
        var serverPort = getServerPortFunction();
        var testPassed = false;

        var clientSocket = net.createConnection( { port: serverPort }, function() {
            console.log("We have successfully connected to the server.");
            clientSocket.write(testMessage);
        });

        clientSocket.setTimeout(120000);

        clientSocket.setKeepAlive(true);

        var currentMessage = "";

        clientSocket.on('data', function(data) {
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
        })
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
    var messageSize = 100;
    var maxPasses = 5;
    return manageMessagePasses(getServerPortFunction, messageSize, maxPasses);
};


// Test

function testSuccessOrFailure(server, getServerPortFunction) {
    exports.startSocketClient(getServerPortFunction)
        .then(function() {
            console.log("All tests ended successfully!");
            server.close();
        }).catch(function(error) {
            console.log("Test failed with: " + error);
            server.close();
        });
}


// This is just for internal testing. The "real" test with the discovery and high bandwidth P2P frameworks
// need to pass in a proper getServerPortFunction.
exports.nodeJSTest = function() {
    var serverPort = 9998;
    var server = exports.startSocketServer(serverPort);
    return testSuccessOrFailure(server, function() { return serverPort; });
};

// This is a mock up of what the actual test function for story -1 should look like. It's a mock up because
// the native functions don't actually work yet. But this should give a sense of what things should look like.
exports.realTest = function() {
    var serverPort = 9998;
    var server = exports.startSocketClient(serverPort);
    var peerIdentifier = getPeerIdentifier();
    var peerName = getDeviceName();
    var peersWeAreTestingAgainst = [];
    cordova('StartPeerCommunications').callNative(peerIdentifier, peerName, serverPort,
        function(startPeerCommunicationsValue) {
            var result = JSON.parse(startPeerCommunicationsValue);
            if (result.result) {
                cordova('peerAvailabilityChanged').registerToNative(function(peerAvailabilityChangedResult) {
                    var peers = JSON.parse(peerAvailabilityChangedResult);
                    for(var i = 0; i < peers.length; i++) {
                        var peer = peerAvailabilityChangedResult[i];
                        if (peer.peerAvailable &&
                            (peersWeAreTestingAgainst.indexOf(peer.peerIdentifier) == -1)) {
                            peersWeAreTestingAgainst.push(peer.peerIdentifier);
                            testSuccessOrFailure(server, function() {
                                cordova('ConnectToDevice').callNative(peer.peerIdentifier,
                                    function(connectToDeviceValue) {
                                        var connectToDeviceValueArray = JSON.parse(connectToDeviceValue);
                                        if (connectToDeviceValueArray[0] == "TRUE") {
                                            return connectToDeviceValueArray[1];
                                        }
                                    });
                            })

                        }
                    }
                });
            } else {
                throw new Error("Call to StartPeerCommunications failed!");
            }
        });
};