/**
 * Created by juksilve on 4.9.2015.
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
        console.log("TCP/IP server  error: " + data.toString());
    });
    this.server.on('close', function () {
        console.log('TCP/IP server  socket is disconnected');
    });

    this.server.listen(port, function() { //'listening' listener
        console.log('TCP/IP server  is bound to : ' + self.port );
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