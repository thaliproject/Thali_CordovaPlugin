/**
 *
 * This test is needing all three files to be present
 *  - testReConnect.js      : the main entry point to the test case
 *  - ReConnectConnector.js : logic that handles the connection & data sending parts
 *  - ReConnectTCPServer.js : logic that handles the server endpoint for connections & data receiving/replying for the test
 *
 * In this test case we try connecting to the remote peer and verify that the connection works by sending small amount of data (that gets echoed back)
 * We measure the time it takes to create the connection, and then disconnect and do re-connections as specified by the test data
 */
'use strict';
var net = require('net');


function ReConnectTCPServer(port) {
    var self = this;
    self.port = port;

    this.stopServer();
    this.server = net.createServer(function (c) { //'connection' listener
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
            console.log("TCP/IP server got data - " + data.length);
            c.write(data.toString());
        });
    });

    this.server.on('error', function (data) {
        console.log("TCP/IP server  error: " + data.toString());
    });
    this.server.on('close', function () {
        console.log('TCP/IP server  socket is disconnected');
    });

    this.server.listen(port, function() { //'listening' listener
        console.log('TCP/IP server  is bound to : ' + this.port);
    });
}
ReConnectTCPServer.prototype.getServerPort = function() {
    return (this.server && this.server.address()) ? this.server.address().port : 0;
}

ReConnectTCPServer.prototype.stopServer = function() {
    if(this.server == null) {
        return;
    }

    this.server.close();
    this.server = null;
}

module.exports = ReConnectTCPServer;
