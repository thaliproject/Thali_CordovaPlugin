/**
 * Created by juksilve on 3.9.2015.
 */
'use strict';

var events = require('events');
var ThaliEmitter = require('thali/thaliemitter');

var ReConnectTCPServer = require('./ReConnectTCPServer');
var ReConnectConnector = require('./ReConnectConnector');

function testReConnect(jsonData,name) {
    var self = this;
    console.log('testReConnect created ' + jsonData);
    this.name = name;
    this.commandData = JSON.parse(jsonData);
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
        for (var i = 0; i < resultData.length; i++) {
            self.resultArray.push(resultData[i]);
        }

        self.testStarted = false;
        if (!self.doneAlready) {
            self.startWithNextDevice();
        }
    }

    this.toFindCount = this.commandData.count;
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
            console.log("a");
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

testReConnect.prototype.startWithNextDevice = function() {
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
    this.endTime = new Date();

    //then get any data that has not been reported yet. i.e. the full rounds have not been done yet
    var resultData = this.testConnector.getResultArray();
    for (var i = 0; i < resultData.length; i++) {
        this.resultArray.push(resultData[i]);
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