/**
 *
 * This test implement's the whole test code in a single file
 *
 * In this test we are simply discovering peers and measuring the time it takes to find them
 *
 */
'use strict';

var events = require('events');
var ThaliEmitter = require('thali/thaliemitter');

/*
"jsonData": {
    "timeout": Specifies the timeout when we would end discovery (in case we have not found all needed peers yet)
    }
*/

function testFindPeers(jsonData, name, addressList) {
    var self = this;
    this.name = name;
    this.bluetoothAddressList = addressList;
    this.commandData = jsonData;
    this.toFindCount = addressList ? addressList.length : 0;
    this.foundPeers = {};
    this.startTime = new Date();
    this.endTime = new Date();
    this.endReason = '';
    this.emitter = new ThaliEmitter();

    console.log('testFindPeers created ' + jsonData);

    this.peerAvailabilityChanged = function(peers) {
        if(self.doneAlready){
            return;
        }
        console.log('peerAvailabilityChanged ' + JSON.stringify(peers));
        peers.forEach(function(peer) {
            self.foundPeers[peer.peerIdentifier] = peer;

            if(!self.foundPeers[peer.peerIdentifier].foundTime){
                var nowTime = new Date();
                self.foundPeers[peer.peerIdentifier].foundTime = nowTime - self.startTime;
            }

            if(self.foundPeers[peer.peerIdentifier].peerAvailable) {
                self.emit('debug', "Found peer : " + peer.peerIdentifier + ", Available: " + peer.peerAvailable);
                console.log("Found peer : " + peer.peerIdentifier + ", peerAvailable: " + peer.peerAvailable);
            }
        });

        var howManyWeDiscoveredAlready = 0;
        for (var foundPeer in self.foundPeers) {
            if (self.foundPeers[foundPeer].peerAvailable) {
                howManyWeDiscoveredAlready = howManyWeDiscoveredAlready + 1;
            }
        }

        if(howManyWeDiscoveredAlready >= self.toFindCount && !self.doneAlready){
            self.endReason = "OK";
            self.weAreDoneNow();
        }
    }
}

testFindPeers.prototype = new events.EventEmitter;

testFindPeers.prototype.start = function() {
    var self = this;
    this.startTime = new Date();
    this.emitter.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, this.peerAvailabilityChanged);

    var serverPort = 8876;//we are not connecting, thus we can use fake port here.
    console.log('serverPort is ' + serverPort);

    this.emitter.startBroadcasting(self.name, serverPort, function (err) {
        if (err) {
            self.endReason = 'StartBroadcasting returned error ' + err;
            self.emit('debug', self.endReason);
            self.weAreDoneNow();
            return;
        } else {
            console.log('StartBroadcasting started ok');
        }
    });

    if(this.commandData.timeout){
        this.timerId = setTimeout(function() {
            console.log('timeout now');
            if(!self.doneAlready)
            {
                self.endReason = "TIMEOUT";
                self.emit('debug', "*** TIMEOUT ***");
                self.weAreDoneNow();
            }
        }, this.commandData.timeout);
    }
}

testFindPeers.prototype.stop = function(doReport) {
    console.log('testFindPeers stopped');
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
    if(doReport){
        this.weAreDoneNow();
    }

    this.doneAlready = true;
}

testFindPeers.prototype.weAreDoneNow = function() {

    if (this.doneAlready) {
        return;
    }

    if (this.timerId != null) {
        clearTimeout(this.timerId);
        this.timerId = null;
    }

    console.log('weAreDoneNow');

    this.doneAlready = true;
    this.endTime = new Date();

    var replyData = [];
    var foundCount = 0;
    for (var foundPeer in this.foundPeers) {
        foundCount++;
        replyData.push({
            "peerName": this.foundPeers[foundPeer].peerName,
            "peerIdentifier": this.foundPeers[foundPeer].peerIdentifier,
            "peerAvailable": this.foundPeers[foundPeer].peerAvailable,
            "time": this.foundPeers[foundPeer].foundTime
        });
    }

    this.emit('debug', "---- finished : findPeers -- ");
    var responseTime = this.endTime - this.startTime;
    this.emit('done', JSON.stringify({
        "name:": this.name,
        "time": responseTime,
        "result": this.endReason,
        "peersList": replyData
    }));
}

module.exports = testFindPeers;
