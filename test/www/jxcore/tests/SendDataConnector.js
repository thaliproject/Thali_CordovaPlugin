/**
 * Created by juksilve on 4.9.2015.
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
    this.reTryTimeOut       = null;
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

    // make sure any previous connections are really out
    if(this.clientSocket != null) {
        console.log("CLIENT closeClientSocket");
        this.clientSocket.end()
        this.clientSocket = null;
    }
    console.log('Connect[' + this.tryRounds + '] to : ' + this.peer.peerName + 'Available: '  + this.peer.peerAvailable);
    this.doConnect(this.peer);
}


SendDataConnector.prototype.Stop = function(peer) {
    console.log("CLIENT Stop now");
    this.stopped = true;
    if(this.reTryTimeOut != null) {
        console.log("Stop retry timer");
        clearTimeout(this.reTryTimeOut);
        this.reTryTimeOut = null;
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
}

SendDataConnector.prototype.doConnect = function(peer) {
    var self = this;

    if(this.stopped){
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

                if(data.toString().trim()  == "10000") {
                    self.receivedCounter = self.receivedCounter + 10000;
                    self.resetDataTimeout(peer);
                }

                console.log('CLIENT is data received : ' + self.receivedCounter);

                if(self.receivedCounter >= self.toSendDataAmount){
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
        }
    });
}

SendDataConnector.prototype.resetDataTimeout = function(peer) {
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
                self.clientSocket.destroy();
                self.clientSocket = null;
            }
            self.tryAgain();
            self.disconnecting = false;
/*            // I have a problem here, I would need to disconnect now & re-start but there is no API for it
            // with client socket end() will not disconnect, but the server keeps the connection open & receives data & replies back
            // and destroy() will do bad thinga on server, and as we are not only connection its not good to cause issues for tests of other devices
            // We need this, since sometimes the data just stops flowing, and we would wait till end of time unless we have a way on doing disconnection
            self.disconnecting = true;
            Mobile('Disconnect').callNative(peer.peerIdentifier, function (err, port) {
                console.log("CLIENT Disconnect, err: " + err);
                self.tryAgain();
                self.disconnecting = false;
            });*/
            console.log("----------------- closeClientSocket");

        }, self.dataTimeOut);
    }
}

SendDataConnector.prototype.tryAgain = function() {
    var self = this;

    if(this.stopped){
        return;
    }

    if(self.reTryTimeOut != null){
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

    console.log("tryAgain afer: " + self.reTryTimeout + " ms.");
    //lets try again after a short while
    self.reTryTimeOut = setTimeout(function () {
        console.log("re-try now : " + self.peer.peerName);
        self.reTryTimeOut = null
        self.ReStart(self.peer);
    }, self.reTryTimeout);
}

SendDataConnector.prototype.oneRoundDoneNow = function() {
    this.Stop();

    this.endTime = new Date();
    var responseTime = this.endTime - this.startTime;
    this.resultArray.push({"name:":this.peer.peerName,"time":responseTime,"result":this.endReason,"connections":this.connectionCount});

    this.emit('debug','round[' +this.doneRounds + '] time: ' + responseTime + ' ms, rnd: ' + this.connectionCount + ', ex: ' + this.endReason);

    this.doneRounds++;
    if(this.roundsToDo > this.doneRounds){
        this.tryRounds = 0;

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

    this.emit('done', JSON.stringify(tmpArr));
}

module.exports = SendDataConnector;
