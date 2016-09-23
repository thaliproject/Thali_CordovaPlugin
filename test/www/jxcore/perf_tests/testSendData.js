/**
 *
 * This test needs all three files to be present
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

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var ThaliEmitter = require('thali/thaliemitter');

var SendDataTCPServer = require('./SendDataTCPServer');
var SendDataConnector = require('./SendDataConnector');

/*
"data": {
    "timeout"        : Specifies the timeout when we would end test (in case we have not already finished all connection rounds yet)
    "rounds"         : Specifies how many connections to each peer we should be doing
    "dataAmount"     : Specifies the amount of data we need ro send over each connection made
    "dataTimeout"    : Specifies timeout used for sending the data and waiting for the reply before we do retry for the connection round.
    "conReTryTimeout": Specifies the time value we wait after unsuccessful connection attempt, before we try again.
    "conReTryCount"  : Specifies the times we do retries for unsuccessful connection attempts before we mark the test round failed
    }
*/

function testSendData(jsonData, name, addressList) {

  var self = this;

  console.log(
    'testSendData created ' + JSON.stringify(jsonData) + 
    'bt-address length : ' + addressList.length
  );

  this.name = name;
  this.commandData = jsonData;
  this.emitter = new ThaliEmitter();
  this.toFindCount = jsonData.peerCount;
  this.bluetoothAddressList = addressList.length > 0 ? addressList : null;
  this.useAddressList = this.bluetoothAddressList !== null;

  this.startTime = new Date();
  this.endTime = new Date();
  this.endReason = '';

  this.debugCallback = function (data) {
    self.emit('debug', data);
  };

  this.doneCallback = function (data) {

    console.log('---- round done--------');

    var resultData = JSON.parse(data);

    var peerAddress  = 0;
    var peerTryCount = 0;
    var areAllTestOk = true;

    // if we use the address list, then we try getting all connections to be successful
    // thus we re-try the ones that were not successful
    // and we schedule the re-try to be handled after all other peers we have in the list currently
    if (self.bluetoothAddressList && self.bluetoothAddressList.length > 0) {
      for (var i = 0; i < resultData.length; i++) {
        if (resultData[i].result != 'OK') {
          areAllTestOk = false;
          peerAddress = resultData[i].name;
          peerTryCount = resultData[i].tryCount;
        }
      }
    }

    // if all was ok, then we'll store the data values, otherwise we'll put the peer back to the 
    // address list
    if (areAllTestOk) {
      for (var i = 0; i < resultData.length; i++) {
        self.resultArray.push(resultData[i]);
      }
    } else if (peerAddress != 0) { //we gotta re-try it later
      console.log('---- gotta redo : ' + peerAddress + ', try count now: ' + peerTryCount);
      self.bluetoothAddressList.push({'address':peerAddress, 'tryCount':peerTryCount});
    }

    self.testStarted = false;
    if (!self.doneAlready) {
      self.startWithNextDevice();
    }
  };

  this.foundSofar = 0;
  this.timerId = null;
  this.foundPeers = {};
  this.resultArray = [];

  this.peerAvailabilityChanged = function (peers) {

    // If we are using the given address list, we are ignoring the peer
    // availability changes and connecting to the peers in the list.
    if (self.useAddressList) {
      return;
    }

    console.log('peerAvailabilityChanged ' + JSON.stringify(peers));

    for (var i = 0; i < peers.length; i++) {

      var peer = peers[i];

      if ((!self.foundPeers[peer.peerIdentifier]) || 
          (!self.foundPeers[peer.peerIdentifier].doneAlready)) {

        self.foundPeers[peer.peerIdentifier] = peer;
        console.log('Found peer : ' + peer.peerName + ', Available: ' + peer.peerAvailable);
      }
    }

    if (!self.testStarted) {
      self.startWithNextDevice();
    }
  };
}

inherits(testSendData, EventEmitter);

testSendData.prototype.start = function (serverPort) {

  var self = this;
  this.doneAlready = false;
  this.testServer = new SendDataTCPServer(serverPort);
  this.testConnector = new SendDataConnector(
    this.commandData.rounds,
    this.commandData.dataAmount,
    this.commandData.conReTryTimeout,
    this.commandData.conReTryCount,
    this.commandData.dataTimeout
  );

  this.testConnector.on('done', this.doneCallback);
  this.testConnector.on('debug', this.debugCallback);

  console.log('check server');
  serverPort = this.testServer.getServerPort();
  console.log('serverPort is ' + serverPort);

  this.emitter.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, this.peerAvailabilityChanged);
  this.emitter.startBroadcasting(self.name, serverPort, function (err) {
    if (err) {
      console.log('StartBroadcasting returned error ' + err);
    } else {
      console.log('StartBroadcasting started ok');
      console.log(self.bluetoothAddressList);

      if (self.bluetoothAddressList && self.bluetoothAddressList.length > 0) {
        if (!self.testStarted) {
          self.startWithNextDevice();
        }
      }
    }
  });

  if (this.commandData.timeout) {
    this.timerId = setTimeout(function () {
      console.log('timeout now');
      if (!self.doneAlready) {
        self.endReason = 'TIMEOUT';
        self.emit('debug', '*** TIMEOUT ***');
        self.weAreDoneNow();
      }
    }, this.commandData.timeout);
  }
};

testSendData.prototype.stop = function (doReport) {

  var self = this;

  console.log('testSendData stopped');

  this.emitter.removeListener(
    ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, this.peerAvailabilityChanged
  );

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

  if (doReport){
    this.emit('debug', '---- sendReportNow');
    this.sendReportNow();
  }
  
  if (this.testConnector != null) {
    this.testConnector.Stop(function () {
      self.testConnector.removeListener('done', self.doneCallback);
      self.testConnector.removeListener('debug', self.debugCallback);
      self.testConnector = null;
    });
  }

  this.testServer.stopServer(function () {
    // No need to do anything since this is the end of this test
  });
};

testSendData.prototype.startWithNextDevice = function () {

  console.log('startWithNextDevice');

  if (this.doneAlready || this.testConnector == null) {
    return;
  }

  if (this.bluetoothAddressList) {

    if (this.bluetoothAddressList.length == 0) {
      this.endReason = 'OK';
      this.weAreDoneNow();
      return;
    }

    console.log('do fake peer & start');

    var fakePeer = {};
    fakePeer.peerAvailable = true;

    var addressItem = this.bluetoothAddressList.shift();
    fakePeer.peerName = addressItem.address;
    fakePeer.peerIdentifier = addressItem.address;
    fakePeer.tryCount = (addressItem.tryCount + 1);

    console.log('Connect to fake peer: ' + fakePeer.peerIdentifier);
    this.testConnector.Start(fakePeer);
    return;

  } else {

    if (this.foundSofar >= this.toFindCount) {
      this.endReason = 'OK';
      this.weAreDoneNow();
      return;
    }

    for (var peerId in this.foundPeers) {
      if (this.foundPeers[peerId].peerAvailable && !this.foundPeers[peerId].doneAlready) {
        this.testStarted = true;
        this.emit('debug', '--- start for : ' + this.foundPeers[peerId].peerName + ' ---');
        this.foundSofar++;
        console.log('device[' + this.foundSofar + ']: ' + this.foundPeers[peerId].peerIdentifier);

        this.foundPeers[peerId].doneAlready = true;
        this.testConnector.Start(this.foundPeers[peerId]);
        return;
      }
    }
  }
};

testSendData.prototype.weAreDoneNow = function () {
  var self = this;

  if (this.doneAlready || this.testConnector == null) {
    return;
  }

  if (this.timerId != null) {
    clearTimeout(this.timerId);
    this.timerId = null;
  }

  console.log('weAreDoneNow, resultArray.length: ' + this.resultArray.length);
  this.doneAlready = true;
  this.sendReportNow();

  if (this.testConnector != null){
    this.testConnector.Stop(function () {
      self.testConnector.removeListener('done', self.doneCallback);
      self.testConnector.removeListener('debug', self.debugCallback);
      self.testConnector = null;
    });
  }

  // The test server can't be stopped here, because even though this device
  // is done with it's own list of peers, it might be still acting as a test
  // peer for some other devices and thus the server is might still be needed.
};

testSendData.prototype.sendReportNow = function () {

  this.endTime = new Date();
  
  console.log('sendReportNow');

  if (this.testConnector != null) {
    var isAlreadyAdded = false;
    var currentTest = this.testConnector.getCurrentTest();

    //then get any data that has not been reported yet. i.e. the full rounds have not been done yet
    var resultData = this.testConnector.getResultArray();
    for (var i = 0; i < resultData.length; i++) {
      this.resultArray.push(resultData[i]);

      if (currentTest && currentTest.name == resultData[i].name) {
        isAlreadyAdded = true;
      }
    }

    if (!isAlreadyAdded && currentTest) {
      this.resultArray.push(currentTest);
    }
  }

  if (this.bluetoothAddressList) {
    for (var ii = 0; ii < this.bluetoothAddressList.length; ii++) {
      if (this.bluetoothAddressList[ii]){
        this.resultArray.push( {
          'connections': this.bluetoothAddressList[ii].tryCount,
          'name': this.bluetoothAddressList[ii].address,
          'time': 0,
          'result': 'Fail'
        });
      }
    }
  }

  this.emit('debug', '---- finished : send-data -- ');
  var responseTime = this.endTime - this.startTime;

  this.emit('done', JSON.stringify({
    'name:': this.name,
    'time': responseTime,
    'result': this.endReason,
    'sendList': this.resultArray
  }));
};

module.exports = testSendData;
