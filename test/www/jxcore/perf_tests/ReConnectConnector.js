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

var net = require('net');
var events = require('events');

function ReConnectConnector(rounds,reTryTimeout,reTryMaxCount,dataTimeOut) {
    this.roundsToDo         = rounds;
    this.doneRounds         = 0;
    this.reTryTimeout       = reTryTimeout;
    this.reTryTimer         = null;
    this.ConnectTimer       = null;
    this.reTryMaxCount      = reTryMaxCount;
    this.dataTimeOut        = dataTimeOut;
    this.clientSocket       = null;
    this.tryRounds          = 0;
    this.resultArray        = [];
    this.connectionCount    = 0;
    this.receivedCounter    = 0;
}

ReConnectConnector.prototype = new events.EventEmitter;

ReConnectConnector.prototype.Start = function(peer) {
    this.peer = peer;
    this.stopped = false;
    //reset the values to make sure they are clean when we start
    this.startTime = new Date();
    this.endTime = new Date();
    this.endReason ="";
    this.doneRounds         = 0;
    this.tryRounds          = 0;
    this.resultArray        = [];
    this.connectionCount    = 0;

    this.ReStart(peer);
}

ReConnectConnector.prototype.ReStart = function(peer) {
    var self = this;

    this.peer = peer;
    if(!this.peer){
        return;
    }

    if(this.ConnectTimer != null){
        return;
    }

    // make sure any previous connections are really out
    if(this.clientSocket != null) {
        console.log("CLIENT closeClientSocket");
        this.clientSocket.end()
        this.clientSocket = null;
    }

    Mobile('Disconnect').callNative(this.peer.peerIdentifier, function () {
        console.log("Disconnected by Mobile call");
    });

    console.log("do connect after : " + this.reTryTimeout + " ms.");

    this.ConnectTimer= setTimeout(function () {
        self.ConnectTimer = null
        console.log('Connect[' + self.tryRounds + '] to : ' + self.peer.peerIdentifier + ' Available: '  + self.peer.peerAvailable);
        self.doConnect(self.peer);
    }, self.reTryTimeout);
}


ReConnectConnector.prototype.Stop = function() {
  
    console.log("CLIENT Stop now");

    this.stopped = true;
    if(this.reTryTimer != null) {
        console.log("Stop retry timer");
        clearTimeout(this.reTryTimer);
        this.reTryTimer = null;
    }

    if(this.ConnectTimer != null) {
        console.log("Stop ConnectTimer timer");
        clearTimeout(this.ConnectTimer);
        this.ConnectTimer = null;
    }

    if (this.dataTimerId != null) {
        console.log("Stop data retrieving timer");
        clearTimeout(this.dataTimerId);
        this.dataTimerId = null;
    }

    //Closing Client socket, will also close connection
    if(this.clientSocket != null) {
        console.log("CLIENT closeClientSocket");
        this.clientSocket.end();
        this.clientSocket = null;
    }

    if(!this.peer){
        return;
    }

    Mobile('Disconnect').callNative(this.peer.peerIdentifier, function () {
        console.log("Disconnected by Mobile call");
    });
}

ReConnectConnector.prototype.doConnect = function(peer) {
    var self = this;

    if(!this.peer){
        return;
    }

    if(this.stopped){
        return;
    }

    console.log("do connect now");
    this.connectionCount++;

    // we only nmeasure the time it takes here to oneRoundDoneNow
    this.startTime = new Date();
    Mobile('Connect').callNative(peer.peerIdentifier, function (err, port) {
        console.log("CLIENT connected to " + port + ", error: " + err);

        if (err != null && err.length > 0) {
            console.log("CLIENT Can not Connect: " + err);
            self.endReason = err;
            self.tryAgain();

        } else if (port > 0) {
            console.log("CLIENT starting client ");

            self.clientSocket = net.connect(port, function () { //'connect' listener
                console.log("CLIENT now sending data 100 bytes ");
                var numbers = [];
                for (var i = 0; i < ((100 / 2) + 1); i++) {
                    numbers[i] = Math.floor(Math.random() * 10);
                }
                self.receivedCounter = 0;
                self.resetDataTimeout(peer);
                self.clientSocket.write(numbers.toString());
            });
            self.clientSocket.on('data', function (data) {
                self.receivedCounter = self.receivedCounter + data.length;
                if(self.receivedCounter >= 100) {
                    self.resetDataTimeout(peer);

                    if (self.dataTimerId != null) {
                        clearTimeout(self.dataTimerId);
                        self.dataTimerId = null;
                    }

                    self.endReason = "OK";
                    console.log('got all data for this round');

                    self.oneRoundDoneNow();
                }
            });
            self.clientSocket.on('close', function () {
                console.log('CLIENT is closed');
            });

            self.clientSocket.on('error', function (ex) {
                console.log("CLIENT got error : " + ex);
                //just making sure that if we get error while disconnecting
                // we are then not calling the tryAgain twice
                if(!self.disconnecting) {
                    self.tryAgain();
                }
            });
        }else{
            console.log("Port in invalid : " + port);
            if(!self.disconnecting) {
                self.tryAgain();
            }
        }
    });
}

ReConnectConnector.prototype.resetDataTimeout = function(peer) {
    var self = this;
    if (self.dataTimerId != null) {
        clearTimeout(self.dataTimerId);
        self.dataTimerId = null;
    }

    if(self.dataTimeOut) {
        self.dataTimerId = setTimeout(function () {
            console.log('Receiving data timeout now');
            self.endReason = "DATA-TIMEOUT";

            self.disconnecting = true;
            //Closing Client socket, will also close connection
            if(self.clientSocket != null) {
                console.log("CLIENT closeClientSocket");
                self.clientSocket.end();
                self.clientSocket.destroy();// this makes sure it gets really closed properly
                self.clientSocket = null;
            }
            self.tryAgain();
            self.disconnecting = false;
            console.log("----------------- closeClientSocket");

        }, self.dataTimeOut);
    }
}

ReConnectConnector.prototype.tryAgain = function() {
    var self = this;

    if(!this.peer){
        return;
    }

    if(this.stopped){
        return;
    }

    if(this.reTryTimer != null){
        return;
    }

    //Closing Client socket, will also close connection
    if(this.clientSocket != null) {
        console.log("CLIENT closeClientSocket");
        this.clientSocket.end();
        this.clientSocket = null;
    }

    this.tryRounds++;
    if(this.tryRounds >= self.reTryMaxCount) {
        this.oneRoundDoneNow();
        return;
    }

    this.ReStart(this.peer);

    /*
    console.log("tryAgain after: " + self.reTryTimeout + " ms.");
    //lets try again after a short while
    self.reTryTimer = setTimeout(function () {
        console.log("re-try now : " + self.peer.peerIdentifier);
        self.reTryTimer = null
        self.ReStart(self.peer);
    }, self.reTryTimeout);*/
}

ReConnectConnector.prototype.oneRoundDoneNow = function() {
    this.Stop();

    if(!this.peer){
        return;
    }

    this.endTime = new Date();
    var responseTime = this.endTime - this.startTime;
    this.resultArray.push({"name":this.peer.peerIdentifier,"time":responseTime,"result":this.endReason,"connections":this.connectionCount,"tryCount":this.peer.tryCount});

    this.emit('debug','round[' +this.doneRounds + '] time: ' + responseTime + ' ms, rnd: ' + this.connectionCount + ', ex: ' + this.endReason);

    this.doneRounds++;
    if(this.roundsToDo > this.doneRounds){
        this.tryRounds = 0;
        this.receivedCounter = 0;

        //reset the values to make sure they are clean when we start new round
        this.startTime = new Date();
        this.endTime = new Date();
        this.endReason ="";
        this.connectionCount = 0;
        this.stopped = false;
        this.ReStart(this.peer);
        return;
    }

    //if we get this far, then we are done
    this.weAreDoneNow();
}

ReConnectConnector.prototype.getCurrentTest = function() {
    if(!this.peer){
        return;
    }

    return {"connections":this.peer.tryCount, "name":this.peer.peerIdentifier,"time":0,"result":"Fail"};
}

ReConnectConnector.prototype.getResultArray = function() {
    return this.resultArray;
}

ReConnectConnector.prototype.weAreDoneNow = function() {
    this.Stop();

    //reset these for next peer test
    this.tryRounds = 0;
    this.startTime = new Date();
    this.endTime = new Date();
    this.endReason ="";
    this.connectionCount = 0;

    var tmpArr = this.resultArray;
    this.resultArray = [];

    this.peer = null;
    this.emit('done', JSON.stringify(tmpArr));
}

module.exports = ReConnectConnector;
