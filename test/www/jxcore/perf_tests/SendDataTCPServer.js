'use strict';

var net = require('net');

var logger = function (value) {
  //console.log(new Date().toJSON() + ' SendDataTCPServer.js: ' + value);
};

function SendDataTCPServer(port) {
    var self = this;
    self.port = port;

    var limitToReport = 10000;

    this.server = net.createServer(function (c) { //'connection' listener
        var receivedDataInBytes = 0;
        var lastReportedAmount = 0;

        logger('TCP/IP server connected');

        c.on('end', function () {
            logger('TCP/IP server is ended');
            c.destroy();
        });

        c.on('error', function (err) {
            logger('TCP/IP server got error : ' + err);
        });

        c.on('data', function (data) {
            receivedDataInBytes += data.length;
            logger('TCP/IP server has received ' + receivedDataInBytes + ' bytes of data');
            var dataSincePreviousReport = receivedDataInBytes - lastReportedAmount;

            if (dataSincePreviousReport >= limitToReport) {
                var acknowledgmentCount = Math.round(dataSincePreviousReport / limitToReport);

                for (var i = 0; i < acknowledgmentCount; i++) {
                    c.write('ACK');
                }

                lastReportedAmount += acknowledgmentCount * limitToReport;
            }
        });
    });

    this.server.on('error', function (data) {
        logger("TCP/IP server  error: " + data.toString());
    });
    this.server.on('close', function () {
        logger('TCP/IP server  socket is disconnected');
    });

    this.server.listen(port, function () {
        logger('TCP/IP server is bound to port: ' + self.getServerPort());
    });
}
SendDataTCPServer.prototype.getServerPort = function() {
    return (this.server && this.server.address()) ? this.server.address().port : 0;
}

SendDataTCPServer.prototype.stopServer = function (callback) {
    if (this.server == null) {
        if (callback) callback();
        return;
    }
    this.server.close(callback);
    this.server = null;
}

module.exports = SendDataTCPServer;
