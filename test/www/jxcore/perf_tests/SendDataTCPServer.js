/**
 *
 * This test is needing all three files to be present
 *  - testSendData.js      : the main entry point to the test case
 *  - SendDataConnector.js : logic that handles the connection & data sending parts
 *  - SendDataTCPServer.js : logic that handles the server endpoint for connections & data receiving/replying for the test
 *
 * In this test case we try connecting to the remote peer and send N-bytes of data (where N should be big amount)
 * If the sending fails in midway, the logic will do reconnection to the same peer and send any remaining bytes until the whole N-bytes are sent over
 * We measure the time it takes to send the data and report that back.
 *
 * If specified the sending is done multiple times for each peer.
 *
 * Note that we don't want to sent the data both ways, and for this reason the server is not simply echoing back the data sent,
 * but actually only sends verifications on getting some predefined amount of data, currently the amount is specified as 10000 bytes
 */

'use strict';
var net = require('net');


function SendDataTCPServer(port) {
    var self = this;
    self.port = port;

    var dataCount = 0;
    var lastReportedCount = 0;
    var limitToReport = 10000;

    this.stopServer();
    this.server = net.createServer(function (c) { //'connection' listener
        console.log('TCP/IP server connected');

        c.on('end', function () {
            console.log('TCP/IP server is ended');
            c.destroy();
        });
        c.on('close', function () {
            console.log('TCP/IP server is close');
        });
        c.on('error', function (err) {
            console.log('TCP/IP server got error : ' + err);
        });

        c.on('data', function (data) {
            dataCount = dataCount + data.length;
            if(dataCount / limitToReport > lastReportedCount){
                lastReportedCount++;
                c.write("" + limitToReport);
            }
        });
    });

    this.server.on('error', function (data) {
        console.log("TCP/IP server error: " + data.toString());
    });
    this.server.on('close', function () {
        console.log('TCP/IP server socket is disconnected');
    });

    this.server.listen(port, function() { //'listening' listener
        console.log('TCP/IP server is bound to : ' + this.server.address().port );
    });
}
SendDataTCPServer.prototype.getServerPort = function() {
    return (this.server && this.server.address()) ? this.server.address().port : 0;
}

SendDataTCPServer.prototype.stopServer = function() {
    if(this.server == null) {
        return;
    }
    this.server.close();
    this.server = null;
}

module.exports = SendDataTCPServer;
