/* jshint node: true */
'use strict';

var StateMachine = require("javascript-state-machine");
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var ConnectionTable = require('./connectionTable');
var ThaliReplicationManager = require('../thalireplicationmanager');
var identityExchangeUtils = require('./identityExchangeUtils');
var LargerHashStateMachine = require('./LargerHashStateMachine');
var SmallerHashStateMachine = require('./SmallerHashStateMachine');

inherits(IdentityExchange, EventEmitter);

IdentityExchange.minFriendlyNameLength = 0;
IdentityExchange.maxFriendlyNameLength = 20;
IdentityExchange.Events = {
  PeerIdentityExchange: "peerIdentityExchange"
};


IdentityExchange.prototype.thaliAppServer = null;
IdentityExchange.prototype.thaliReplicationManager = null;
IdentityExchange.prototype.dbName = null;
IdentityExchange.prototype.connectionTable = null;
IdentityExchange.prototype.identityExchangeStateMachine = null;
IdentityExchange.prototype.thaliEmitterListener = null;
IdentityExchange.prototype.myPublicKeyHashBuffer = null;
IdentityExchange.prototype.largerHashStateMachine = null;
IdentityExchange.prototype.smallerHashStateMachine = null;
IdentityExchange.prototype.identityExchangeDeviceName = null;
IdentityExchange.prototype.codeListener = null;
IdentityExchange.prototype.smallerHashExitListener = null;

function onStartIdentityExchangeCalled(event, from, to, self, myFriendlyName, cb) {
  if (!myFriendlyName || typeof myFriendlyName !== "string" ||
      myFriendlyName.length < IdentityExchange.minFriendlyNameLength ||
      myFriendlyName.length > IdentityExchange.maxFriendlyNameLength) {
    cb(new Error("myFriendlyName MUST be a string that is between 1 and 20 characters long, inclusive."));
  }

  self.connectionTable = new ConnectionTable(self.thaliReplicationManager);

  self.thaliEmitterListener = function (peers) {
    peers.forEach(function (peer) {
      if (peer.peerName.indexOf(';') !== -1) {
        var split = peer.peerName.split(';');
        peer.peerFriendlyName = split[1];
        peer.peerName = split[0];

        self.emit(IdentityExchange.Events.PeerIdentityExchange, peer);
      }
    })
  };

  self.thaliReplicationManager._emitter.on('peerAvailabilityChanged', self.thaliEmitterListener);

  return identityExchangeUtils.getDeviceIdentityFromThaliReplicationManager(self.thaliReplicationManager)
      .then(function(deviceName) {
        self.myPublicKeyHashBuffer = new Buffer(deviceName, 'base64');

        self.largerHashStateMachine =
            new LargerHashStateMachine(self.thaliAppServer, self.myPublicKeyHash);
        self.largerHashStateMachine.start();

        self.identityExchangeDeviceName = deviceName + ";" + myFriendlyName;

        return identityExchangeUtils.startThaliReplicationManager(self.thaliReplicationManager,
            self.thaliAppServer.address().port, self.dbName,
            self.identityExchangeDeviceName);
      }).then(function() {
        self.identityExchangeStateMachine.startIdentityExchangeCalledCBDone();
        if (cb) {
          cb(null);
        }
      }).catch(function(err) {
        self.identityExchangeStateMachine.startIdentityExchangeCalledCBFail();
        if (cb) {
          cb(err);
        }
      });
}

function onStopIdentityExchangeCalled(event, from, to, self, cb) {
  if (self.thaliEmitterListener) {
    self.thaliReplicationManager.removeListener('peerAvailabilityChanged', self.thaliEmitterListener);
  }

  self.connectionTable.cleanUp();
  self.connectionTable = null;

  self.largerHashStateMachine.stop();

  return identityExchangeUtils.stopThaliReplicationManager(self.thaliReplicationManager)
      .catch(function(err) {
        return err
      }).then(function(err) {
        self.identityExchangeStateMachine.stopIdentityExchangeCalledCBDone();
        if (cb){
          cb(err);
        }
      });
}

function onExecuteIdentityExchangeCalled(event, from, to, self, peerIdentifier, otherPkHash, cb) {
  if (!cb) {
    throw new Error("cb is required.");
  }

  self.codeListener = function(code) {
    cb(null, code);
  };

  self.largerHashStateMachine.on(LargerHashStateMachine.Events.ValidationCodeGenerated,
                                  self.codeListener);
  self.largerHashStateMachine.exchangeIdentity(new Buffer(otherPkHash, 'base64'));


  self.smallerHashExitListener = function(err) {
    cb(err);
    self.smallerHashStateMachine.stopExecutingIdentityExchangeCalled(self, peerIdentifier);
  };

  self.smallerHashStateMachine = new SmallerHashStateMachine(self.thaliReplicationManager, self.connectionTable,
    peerIdentifier, otherPkHash, self.myPublicKeyHashBuffer, self.thaliAppServer.address().port,
    self.dbName, self.identityExchangeDeviceName);
  self.smallerHashStateMachine.on(SmallerHashStateMachine.Events.ValidationCode, self.codeListener);
  self.smallerHashStateMachine.on(SmallerHashStateMachine.Events.Exited, self.smallerHashExitListener);
  self.smallerHashStateMachine.start();
}

function onStopExecutingIdentityExchangeCalled(event, from, to, self) {
  self.largerHashStateMachine.removeListener(LargerHashStateMachine.Events.ValidationCodeGenerated,
                                              self.codeListener);
  self.largerHashStateMachine.stop();

  self.smallerHashStateMachine.removeListener(SmallerHashStateMachine.Events.ValidationCode,
                                              self.codeListener);
  self.smallerHashStateMachine.removeListener(SmallerHashStateMachine.Events.Exited,
                                              self.smallerHashExitListener);
  self.smallerHashStateMachine.stop();
  self.smallerHashStateMachine = null;
}

IdentityExchange.prototype.startIdentityExchange = function(myFriendlyName, cb) {
  return this.identityExchangeStateMachine.startIdentityExchangeCalled(this, myFriendlyName, cb);
};

IdentityExchange.prototype.stopIdentityExchange = function(cb) {
  return this.identityExchangeStateMachine.stopIdentityExchangeCalled(this, cb);
};

IdentityExchange.prototype.executeIdentityExchange = function(peerIdentifier, otherPkHash, cb) {
  return this.identityExchangeStateMachine.executeIdentityExchangeCalled(this, peerIdentifier, otherPkHash, cb);
};

IdentityExchange.prototype.stopExecutingIdentityExchange = function() {
  return this.identityExchangeStateMachine.stopExecutingIdentityExchangeCalled(this);
};

function IdentityExchange(thaliAppServer, thaliReplicationManager, dbName) {
  EventEmitter.call(this);
  this.thaliAppServer = thaliAppServer;
  this.thaliReplicationManager = thaliReplicationManager;
  this.dbName = dbName;
  this.identityExchangeStateMachine = StateMachine.create({
    initial: 'wait',
    events: [
      { name: 'startIdentityExchangeCalled', from: 'wait', to: 'startIdentityExchangeCalledCB'},
      { name: 'startIdentityExchangeCalledCBFail', from: 'startIdentityExchangeCalledCB', to: 'wait'},
      { name: 'startIdentityExchangeCalledCBDone', from: 'startIdentityExchangeCalledCB',
        to: 'findPeersDoingIdentityExchange'},

      { name: 'stopIdentityExchangeCalled', from: 'findPeersDoingIdentityExchange',
        to: 'stopIdentityExchangeCalledCB'},
      { name: 'stopIdentityExchangeCalledCBDone', from: 'stopIdentityExchangeCalledCB', to: 'wait'},

      { name: 'executeIdentityExchangeCalled', from: 'findPeersDoingIdentityExchange', to: 'exchangeIdentity'},

      { name: 'stopExecutingIdentityExchangeCalled', from: 'exchangeIdentity', to: 'findPeersDoingIdentityExchange'}
    ],
    callbacks: {
      onstartIdentityExchangeCalled: onStartIdentityExchangeCalled,
      onstopIdentityExchangeCalled: onStopIdentityExchangeCalled,
      onexecuteIdentityExchangeCalled: onExecuteIdentityExchangeCalled,
      onstopExecutingIdentityExchangeCalled: onStopExecutingIdentityExchangeCalled
    }
  });
}

module.exports = IdentityExchange;