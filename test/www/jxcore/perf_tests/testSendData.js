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

var events = require('events');
var ThaliEmitter = require('thali/thaliemitter');

var SendDataTCPServer = require('./SendDataTCPServer');
var SendDataConnector = require('./SendDataConnector');

/*
"data": {
    "count"          : Specifies the number of peers we would need to do the connections to
    "timeout"        : Specifies the timeout when we would end test (in case we have not already finished all connection rounds yet)
    "rounds"         : Specifies how many connections to each peer we should be doing
    "dataAmount"     : Specifies the amount of data we need ro send over each connection made
    "dataTimeout"    : Specifies timeout used for sending the data and waiting for the reply before we do retry for the connection round.
    "conReTryTimeout": Specifies the time value we wait after unsuccessful connection attempt, before we try again.
    "conReTryCount"  : Specifies the times we do retries for unsuccessful connection attempts before we mark the test round failed
    }
*/

function testSendData(jsonData,name) {
    var self = this;
    this.name = name;
    this.commandData = JSON.parse(jsonData);
    this.emitter = new ThaliEmitter();
    this.toFindCount = this.commandData.count;
    console.log('testSendData created ' + jsonData);

    this.startTime = new Date();
    this.endTime = new Date();
    this.endReason = "";

    this.debugCallback = function (data) {
        self.emit('debug', data);
    }

    this.doneCallback = function (data) {
        console.log('---- round done--------');
        var resultData = JSON.parse(data);
        for (var i = 0; i < resultData.length; i++) {
            self.resultArray.push(resultData[i]);
        }

        self.testStarted = false;
        if (!self.doneAlready) {
            self.startWithNextDevice();
        }
    }

    this.foundSofar = 0;
    this.timerId = null;
    this.foundPeers = {};
    this.resultArray = [];

    this.peerAvailabilityChanged = function(peers) {
        console.log('peerAvailabilityChanged ' + peers);
        for (var i = 0; i < peers.length; i++) {
            var peer = peers[i];
            if ((!self.foundPeers[peer.peerIdentifier]) || (!self.foundPeers[peer.peerIdentifier].doneAlready)) {
                self.foundPeers[peer.peerIdentifier] = peer;
                console.log("Found peer : " + peer.peerName + ", Available: " + peer.peerAvailable);
            }
        }

        if (!self.testStarted) {
            self.startWithNextDevice();
        }
    }
}

testSendData.prototype = new events.EventEmitter;

testSendData.prototype.start = function() {
    var self = this;
    this.testServer = new SendDataTCPServer();
    this.testConnector = new SendDataConnector(this.commandData.rounds,this.commandData.dataAmount,this.commandData.conReTryTimeout,this.commandData.conReTryCount,this.commandData.dataTimeout);
    this.testConnector.on('done', this.doneCallback);
    this.testConnector.on('debug',this.debugCallback);

    console.log('check server');
    var serverPort = this.testServer.getServerPort();
    console.log('serverPort is ' + serverPort);

    this.emitter.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, this.peerAvailabilityChanged);
    this.emitter.startBroadcasting(self.name, serverPort, function (err) {
        if (err) {
            console.log('StartBroadcasting returned error ' + err);
        } else {
            console.log('StartBroadcasting started ok');
        }
    });

    if(this.commandData.timeout){
        this.timerId = setTimeout(function() {
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

testSendData.prototype.stop = function(doReport) {
    console.log('testSendData stopped');

    this.emitter.removeListener(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, this.peerAvailabilityChanged);
    this.emitter.stopBroadcasting(function (err) {
        if (err) {
            console.log('StopBroadcasting returned error ' + err);
        } else {
            console.log('StopBroadcasting went ok');
        }
    });

    if (this.timerId != null) {
        clearTimeout(this.timerId);
        this.timerId = null;
    }

    this.testServer.stopServer();

    if(this.testConnector != null){
        this.testConnector.Stop();
        this.testConnector.removeListener('done', this.doneCallback);
        this.testConnector.removeListener('debug', this.debugCallback);
        this.testConnector = null;
    }

    if(doReport){
        this.weAreDoneNow();
    }

    this.doneAlready = true;
}

testSendData.prototype.startWithNextDevice = function() {
    if(this.doneAlready || this.testConnector == null) {
        return;
    }

    if(this.foundSofar >= this.toFindCount){
        this.endReason = "OK";
        this.weAreDoneNow();
        return;
    }

    for(var peerId in this.foundPeers){
        if(this.foundPeers[peerId].peerAvailable && !this.foundPeers[peerId].doneAlready){
            this.testStarted = true;
            this.emit('debug', '--- start for : ' + this.foundPeers[peerId].peerName + ' ---');
            this.foundSofar++
            console.log('device[' + this.foundSofar +  ']: ' + this.foundPeers[peerId].peerIdentifier);

            this.foundPeers[peerId].doneAlready = true;
            this.testConnector.Start(this.foundPeers[peerId]);
            return;
        }
    }
}

testSendData.prototype.weAreDoneNow = function() {

    if (this.doneAlready || this.testConnector == null) {
        return;
    }

    if (this.timerId != null) {
        clearTimeout(this.timerId);
        this.timerId = null;
    }

    console.log('weAreDoneNow , resultArray.length: ' + this.resultArray.length);
    this.doneAlready = true;
    this.endTime = new Date();

    //then get any data that has not been reported yet. i.e. the full rounds have not been done yet
    var resultData = this.testConnector.getResultArray();
    for (var i = 0; i < resultData.length; i++) {
        this.resultArray.push(resultData[i]);
    }

    this.emit('debug', "---- finished : send-data -- ");
    var responseTime = this.endTime - this.startTime;
    this.emit('done', JSON.stringify({
        "name:": this.name,
        "time": responseTime,
        "result": this.endReason,
        "sendList": this.resultArray
    }));
}

module.exports = testSendData;