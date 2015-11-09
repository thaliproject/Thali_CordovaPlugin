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

var net = require('net');
var events = require('events');

function SendDataConnector(rounds,dataAmount,reTryTimeout,reTryMaxCount,dataTimeOut) {
    this.roundsToDo         = rounds;
    this.doneRounds         = 0;
    this.toSendDataAmount   = dataAmount;
    this.reTryTimeout       = reTryTimeout;
    this.reTryMaxCount      = reTryMaxCount;
    this.dataTimeOut        = dataTimeOut;
    this.clientSocket       = null;
    this.reTryTimer         = null;
    this.receivedCounter    = 0;
    this.tryRounds          = 0;
    this.resultArray        = [];
    this.connectionCount    = 0;
}

SendDataConnector.prototype = new events.EventEmitter;

SendDataConnector.prototype.Start = function(peer) {
    this.peer = peer;
    this.stopped = false;
    //reset the values to make sure they are clean when we start
    this.startTime = new Date();
    this.endTime = new Date();
    this.endReason ="";
    this.doneRounds         = 0;
    this.receivedCounter    = 0;
    this.tryRounds          = 0;
    this.resultArray        = [];
    this.connectionCount    = 0;

    this.ReStart(peer);
}

SendDataConnector.prototype.ReStart = function(peer) {
    this.peer = peer;
    if (!this.peer){
        return;
    }

    // make sure any previous connections are really out
    if (this.clientSocket != null) {
        console.log("CLIENT closeClientSocket");
        this.clientSocket.end()
        this.clientSocket = null;
    }

    Mobile('Disconnect').callNative(this.peer.peerIdentifier, function () {
        console.log("Disconnected by Mobile call");
    });

    console.log('Connect[' + this.tryRounds + '] to : ' + this.peer.peerIdentifier + 'Available: '  + this.peer.peerAvailable);
    this.doConnect(this.peer);
}


SendDataConnector.prototype.Stop = function(peer) {
    console.log("CLIENT Stop now");
    this.stopped = true;
    if (this.reTryTimer != null) {
        console.log("Stop retry timer");
        clearTimeout(this.reTryTimer);
        this.reTryTimer = null;
    }

    if (this.dataTimerId != null) {
        console.log("Stop data retrieving timer");
        clearTimeout(this.dataTimerId);
        this.dataTimerId = null;
    }

    //Closing Client socket, will also close connection
    if (this.clientSocket != null) {
        console.log("CLIENT closeClientSocket");
        this.clientSocket.end();
        this.clientSocket = null;
    }

    if (!this.peer){
        return;
    }

    Mobile('Disconnect').callNative(this.peer.peerIdentifier, function () {
        console.log("Disconnected by Mobile call");
    });
}

SendDataConnector.prototype.doConnect = function(peer) {
    var self = this;

    if (this.stopped){
        return;
    }

    if (!this.peer){
        return;
    }

    console.log("do connect now");
    this.connectionCount++;

    Mobile('Connect').callNative(peer.peerIdentifier, function (err, port) {
        console.log("CLIENT connected to " + port + ", error: " + err);

        if (err != null && err.length > 0) {
            console.log("CLIENT Can not Connect: " + err);
            self.endReason = err;
            self.tryAgain();

        } else if (port > 0) {
            console.log("CLIENT starting client ");

            self.clientSocket = net.connect(port, function () { //'connect' listener
                console.log("CLIENT now sending data: " + (self.toSendDataAmount - self.receivedCounter));
                var numbers = [];
                for (var i = 0; i < (((self.toSendDataAmount - self.receivedCounter) / 2) + 1); i++) {
                    numbers[i] = Math.floor(Math.random() * 10);
                }
                self.resetDataTimeout(peer);
                self.clientSocket.write(numbers.toString());
            });

            self.clientSocket.on('data', function (data) {

                if (data.toString().trim()  == "10000") {
                    self.receivedCounter = self.receivedCounter + 10000;
                    self.resetDataTimeout(peer);
                }

                console.log('CLIENT is data received : ' + self.receivedCounter);

                if (self.receivedCounter >= self.toSendDataAmount){
                    if (self.dataTimerId != null) {
                        clearTimeout(self.dataTimerId);
                        self.dataTimerId = null;
                    }

                    self.endReason = "OK";
                    console.log('got all data for this round');

                    //we only reset the value once we have gotten all data, so any re-connect will sent only missing data
                    self.receivedCounter = 0;
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

        } else {
            console.log("Port in invalid : " + port);
            if (!self.disconnecting) {
                self.tryAgain();
            }
        }
    });
}

SendDataConnector.prototype.resetDataTimeout = function(peer) {
    var self = this;
    if (self.dataTimerId != null) {
        clearTimeout(self.dataTimerId);
        self.dataTimerId = null;
    }

    if (self.dataTimeOut) {
        self.dataTimerId = setTimeout(function () {
            console.log('Receiving data timeout now');
            self.endReason = "DATA-TIMEOUT";

            self.disconnecting = true;
            //Closing Client socket, will also close connection
            if (self.clientSocket != null) {
                console.log("CLIENT closeClientSocket");
                self.clientSocket.end();
                self.clientSocket.destroy();
                self.clientSocket = null;
            }
            self.tryAgain();
            self.disconnecting = false;
            console.log("----------------- closeClientSocket");

        }, self.dataTimeOut);
    }
}

SendDataConnector.prototype.tryAgain = function() {
    var self = this;

    if(this.stopped){
        return;
    }

    if(self.reTryTimer != null){
        return;
    }

    //Closing Client socket, will also close connection
    if (this.clientSocket != null) {
        console.log("CLIENT closeClientSocket");
        this.clientSocket.end();
        this.clientSocket = null;
    }

    this.tryRounds++;
    if (this.tryRounds >= self.reTryMaxCount) {
        this.oneRoundDoneNow();
        return;
    }

    console.log("tryAgain afer: " + self.reTryTimeout + " ms.");
    //lets try again after a short while
    self.reTryTimer = setTimeout(function () {

        if (!self.peer){
            return;
        }

        console.log("re-try now : " + self.peer.peerIdentifier);
        self.reTryTimer = null
        self.ReStart(self.peer);
    }, self.reTryTimeout);
}

SendDataConnector.prototype.oneRoundDoneNow = function() {
    this.Stop();

    if (!this.peer){
        return;
    }

    this.endTime = new Date();
    var responseTime = this.endTime - this.startTime;
    this.resultArray.push({"name":this.peer.peerIdentifier,"time":responseTime,"result":this.endReason,"connections":this.connectionCount,"tryCount":this.peer.tryCount});

    this.emit('debug','round[' +this.doneRounds + '] time: ' + responseTime + ' ms, rnd: ' + this.connectionCount + ', ex: ' + this.endReason);

    this.doneRounds++;
    if (this.roundsToDo > this.doneRounds){
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

SendDataConnector.prototype.getCurrentTest = function() {
    if (!this.peer){
        return;
    }

    return {"connections":this.peer.tryCount, "name":this.peer.peerIdentifier,"time":0,"result":"Fail"};
}

SendDataConnector.prototype.getResultArray = function() {
    return this.resultArray;
}

SendDataConnector.prototype.weAreDoneNow = function() {
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

module.exports = SendDataConnector;
