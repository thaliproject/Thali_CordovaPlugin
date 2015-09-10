/**
 * Created by juksilve on 2.9.2015.
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
            // BUGBUG: On the desktop this event listener is not necessary. But on JXCore on Android
            // we have to include this handler or no data will ever arrive at the server.
            // Please see https://github.com/jxcore/jxcore/issues/411
            console.log("TCP/IP server got data - " + data.length);
            c.write(data.toString());
        });

        // when using piping, I don't get 'data' events, and as in debug time I want to log them
        // I'm doing write operations in the data event, instead doing the piping
        // c.pipe(c);
    });

    this.server.on('error', function (data) {
        console.log("TCP/IP server  error: " + data.toString());
    });
    this.server.on('close', function () {
        console.log('TCP/IP server  socket is disconnected');
    });

    this.server.listen(port, function() { //'listening' listener
        console.log('TCP/IP server  is bound to : ' + self.port);
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