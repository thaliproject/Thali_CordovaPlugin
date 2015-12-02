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

var events = require('events');
var ThaliEmitter = require('thali/thaliemitter');

var ReConnectTCPServer = require('./ReConnectTCPServer');
var ReConnectConnector = require('./ReConnectConnector');

/*
"jsonData": {
    "timeout"        : Specifies the timeout when we would end test (in case we have not already finished all connection rounds yet)
    "rounds"         : Specifies how many connections to each peer we should be doing
    "dataTimeout"    : Specifies timeout used for sending the data and waiting for the reply before we do retry for the connection round.
    "conReTryTimeout": Specifies the time value we wait after unsuccessful connection attempt, before we try again.
    "conReTryCount"  : Specifies the times we do retries for unsuccessful connection attempts before we mark the test round failed
    }
*/
function testReConnect(jsonData, name, dev, addressList) {
    var self = this;
    console.log('testReConnect created ' + jsonData + ", bt-address length: " + addressList.length);
    this.name = name;

    if(addressList.length > 0) {
        this.BluetoothAddressList = addressList;
    }
    this.commandData = jsonData;
    this.emitter = new ThaliEmitter();
    this.startTime = new Date();
    this.endTime = new Date();
    this.endReason = "";

    this.debugCallback = function (data) {
        self.emit('debug', data);
    }

    this.doneCallback = function (data) {
        console.log('---- round done--------');
        var resultData = JSON.parse(data);

        var peerAddress  = 0;
        var peerTryCount = 0;

        var areAllTestOk = true;

        // if we use the address list, then we try getting all connections to be successful
        // thus we re-try the ones that were not successful
        // and we schedule the re-try to be handled after all other peers we have in the list currently
        if(self.BluetoothAddressList) {
            for (var i = 0; i < resultData.length; i++) {
                if (resultData[i].result != "OK") {
                    areAllTestOk = false;
                    peerAddress = resultData[i].name;
                    peerTryCount = resultData[i].tryCount;
                }
            }
        }

        // if all was ok, then we'll store the data values, othervise we'll put the peer back to the address list
        if(areAllTestOk) {
            for (var i = 0; i < resultData.length; i++) {
                self.resultArray.push(resultData[i]);
            }
        }else if(peerAddress != 0){ //we gotta re-try it later
            console.log('---- gotta redo : ' + peerAddress + ", try count now: " + peerTryCount);
            self.BluetoothAddressList.push({"address":peerAddress,"tryCount":peerTryCount});
        }

        // see if we need to go and do next round
        self.testStarted = false;
        if (!self.doneAlready) {
            self.startWithNextDevice();
        }
    }

    this.toFindCount = dev;
    this.foundSofar = 0;
    this.timerId = null;
    this.foundPeers = {};
    this.resultArray = [];


    this.peerAvailabilityChanged = function(peers) {

        //we have address list, so we use it instead
        if(self.BluetoothAddressList){
            return;
        }

        console.log('peerAvailabilityChanged ' + JSON.stringify(peers));
        for (var i = 0; i < peers.length; i++) {
            var peer = peers[i];
            if ((!self.foundPeers[peer.peerIdentifier]) || (!self.foundPeers[peer.peerIdentifier].doneAlready)) {
                self.foundPeers[peer.peerIdentifier] = peer;
            }
        }

        if (!self.testStarted) {
            self.startWithNextDevice();
        }
    }
}

testReConnect.prototype = new events.EventEmitter;

testReConnect.prototype.start = function() {
    var self = this;
    this.testServer = new ReConnectTCPServer();
    this.testConnector = new ReConnectConnector(this.commandData.rounds,this.commandData.conReTryTimeout,this.commandData.conReTryCount,this.commandData.dataTimeout);
    this.testConnector.on('done', this.doneCallback);
    this.testConnector.on('debug',this.debugCallback);

    var serverPort = this.testServer.getServerPort();
    console.log('serverPort is ' + serverPort);

    this.emitter.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, this.peerAvailabilityChanged);
    this.emitter.startBroadcasting(self.name, serverPort, function (err) {
        if (err) {
            self.endReason = 'StartBroadcasting returned error ' + err;
            self.emit('debug', self.endReason);
            self.weAreDoneNow();
        } else {
            console.log('StartBroadcasting started ok');

            if(self.BluetoothAddressList) {
                if (!self.testStarted) {
                    self.startWithNextDevice();
                }
            }
        }
    });

    if(this.commandData.timeout){
        self.timerId = setTimeout(function() {
            console.log('timeout now');
            if(!self.doneAlready)
            {
                console.log('dun');
                self.endReason = "TIMEOUT";
                self.emit('debug', "*** TIMEOUT ***");
                self.weAreDoneNow();
            }
        }, this.commandData.timeout);
    }
}

testReConnect.prototype.stop = function(doReport) {
    console.log('testReConnect stopped');

    if (this.timerId != null) {
        clearTimeout(this.timerId);
        this.timerId = null;
    }

    this.emitter.removeListener(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, this.peerAvailabilityChanged);
    this.emitter.stopBroadcasting(function (err) {
        if (err) {
            console.log('StopBroadcasting returned error ' + err);
        } else {
            console.log('StopBroadcasting went ok');
        }
    });

    this.testServer.stopServer();

    if(doReport){
        this.emit('debug', "---- sendReportNow");
        this.sendReportNow();
    }

    if(this.testConnector != null){
        this.testConnector.Stop();
        this.testConnector.removeListener('done', this.doneCallback);
        this.testConnector.removeListener('debug', this.debugCallback);
        this.testConnector = null;
    }

    this.doneAlready = true;
}

testReConnect.prototype.startWithNextDevice = function() {
    if(this.doneAlready || this.testConnector == null) {
       return;
    }

    if(this.BluetoothAddressList){

        if(this.BluetoothAddressList.length <= 0){
            this.endReason = "OK";
            this.weAreDoneNow();
            return;
        }

        console.log('do fake peer & start');

        var fakePeer = {};
        fakePeer.peerAvailable = true;

        var addressItem = this.BluetoothAddressList.shift();
        fakePeer.peerIdentifier = addressItem.address;
        fakePeer.tryCount       = (addressItem.tryCount + 1);

        console.log('Connect to fake peer: ' + fakePeer.peerIdentifier);
        this.testConnector.Start(fakePeer);
        return;
    }else {

        if (this.foundSofar >= this.toFindCount) {
            this.endReason = "OK";
            this.weAreDoneNow();
            return;
        }

        for (var peerId in this.foundPeers) {
            if (this.foundPeers[peerId].peerAvailable && !this.foundPeers[peerId].doneAlready) {
                this.testStarted = true;
                this.emit('debug', '--- start for : ' + this.foundPeers[peerId].peerIdentifier + ' ---');
                this.foundSofar++
                console.log('device[' + this.foundSofar + ']: ' + this.foundPeers[peerId].peerIdentifier);

                this.foundPeers[peerId].doneAlready = true;
                this.testConnector.Start(this.foundPeers[peerId]);
                return;
            }
        }
    }
}

testReConnect.prototype.weAreDoneNow = function() {
    if (this.doneAlready || this.testConnector == null) {
        return;
    }

    if (this.timerId != null) {
        clearTimeout(this.timerId);
        this.timerId = null;
    }

    console.log('weAreDoneNow , resultArray.length: ' + this.resultArray.length);
    this.doneAlready = true;
    this.sendReportNow();

    if(this.testConnector != null){
        this.testConnector.Stop();
        this.testConnector.removeListener('done', this.doneCallback);
        this.testConnector.removeListener('debug', this.debugCallback);
        this.testConnector = null;
    }
}

testReConnect.prototype.sendReportNow = function() {
    this.endTime = new Date();

    if(this.testConnector != null) {
        var isAlreadyAdded = false;
        var currentTest = this.testConnector.getCurrentTest();

        //then get any data that has not been reported yet. i.e. the full rounds have not been done yet
        var resultData = this.testConnector.getResultArray();
        for (var i = 0; i < resultData.length; i++) {
            this.resultArray.push(resultData[i]);

            if(currentTest && currentTest.name == resultData[i].name){
                isAlreadyAdded = true;
            }
        }

        if (!isAlreadyAdded && currentTest) {
            this.resultArray.push(currentTest);
        }
    }

    if(this.BluetoothAddressList){
        for(var ii = 0; ii < this.BluetoothAddressList.length; ii++){
            if(this.BluetoothAddressList[ii]){
                this.resultArray.push({"name":this.BluetoothAddressList[ii].address,"time":0,"result":"Fail","connections":this.BluetoothAddressList[ii].tryCount});
            }
        }
    }

    this.emit('debug', "---- finished : re-Connect -- ");
    var responseTime = this.endTime - this.startTime;
    this.emit('done', JSON.stringify({
        "name:": this.name,
        "time": responseTime,
        "result": this.endReason,
        "connectList": this.resultArray
    }));
}

module.exports = testReConnect;
