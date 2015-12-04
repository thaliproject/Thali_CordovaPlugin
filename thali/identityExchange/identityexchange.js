'use strict';

var StateMachine = require('javascript-state-machine');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var ConnectionTable = require('./connectionTable');
var identityExchangeUtils = require('./identityExchangeUtils');
var LargerHashStateMachine = require('./LargerHashStateMachine');
var SmallerHashStateMachine = require('./SmallerHashStateMachine');
var ThaliEmitter = require('../thaliemitter');
var logger = require('../thalilogger')('identityExchange');
var urlSafeBase64 = require('urlsafe-base64');

inherits(IdentityExchange, EventEmitter);

IdentityExchange.minFriendlyNameLength = 0;
IdentityExchange.maxFriendlyNameLength = 20;
IdentityExchange.Events = {
  PeerIdentityExchange: 'peerIdentityExchange'
};

IdentityExchange.prototype.thaliApp = null;
IdentityExchange.prototype.thaliServerPort = null;
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

function onStartIdentityExchangeCalled(
  event,
  from,
  to,
  self,
  myFriendlyName,
  cb) {

  if (!myFriendlyName || typeof myFriendlyName !== 'string' ||
      myFriendlyName.length < IdentityExchange.minFriendlyNameLength ||
      myFriendlyName.length > IdentityExchange.maxFriendlyNameLength) {

    cb(new Error('myFriendlyName MUST be a string that is between 1 and 20 characters long, inclusive.'));
    return;
  }

  self.connectionTable = new ConnectionTable(self.thaliReplicationManager);

/*
It isn't legal to call executeIdentityExchange until after the cb has returned
from onStartIdentityExchange. But this creates a race condition where we could
emit a PeerIdentityExchange event causing someone to want to call
executeIdentityExchange before we have had a chance to return from the
promises below. This would then cause the executeIdentityExchange method to
fail because we haven't switched states yet. To address this we queue up any
peers we find while we wait for the replication manager to get going and
then return them once everything is set up.
*/
  var storedPeers = [];
  self.thaliEmitterListener = function(peer) {
    storedPeers.push(peer);
  };

  self.thaliReplicationManager._emitter.on(
    ThaliEmitter.events.PEER_AVAILABILITY_CHANGED,
    self.thaliEmitterListener
  );

  return identityExchangeUtils.getDeviceIdentityFromThaliReplicationManager(
      self.thaliReplicationManager
    )
    .then(function(deviceName) {
      self.myPublicKeyHashBuffer = urlSafeBase64.decode(deviceName);

      if (!self.largerHashStateMachine) {
        self.largerHashStateMachine = new LargerHashStateMachine(
          self.thaliApp,
          self.myPublicKeyHashBuffer
        );
      }
      self.largerHashStateMachine.start();

      self.identityExchangeDeviceName = deviceName + ';' + myFriendlyName;
      logger.info('We will advertise the following device name as we start: '
        + self.identityExchangeDeviceName);

      return identityExchangeUtils.startThaliReplicationManager(
        self.thaliReplicationManager,
        self.thaliServerPort, self.dbName,
        self.identityExchangeDeviceName
      );
    }).then(function() {
      self.identityExchangeStateMachine.startIdentityExchangeCalledCBDone();

      function emitPeer(peer) {
        if (peer.peerName.indexOf(';') !== -1) {
          var split = peer.peerName.split(';');
          peer.peerFriendlyName = split[1];
          peer.peerName = split[0];

          self.emit(IdentityExchange.Events.PeerIdentityExchange, peer);
        }
      }

      storedPeers.forEach(emitPeer);

      self.thaliReplicationManager._emitter.removeListener(
        ThaliEmitter.events.PEER_AVAILABILITY_CHANGED,
        self.thaliEmitterListener
      );

      self.thaliEmitterListener = function (peers) {
        peers.forEach(emitPeer);
      };

      self.thaliReplicationManager._emitter.on(
        ThaliEmitter.events.PEER_AVAILABILITY_CHANGED,
        self.thaliEmitterListener
      );

      // Technically we should emit the events after we call the user's callback so that the user
      // always knows that their start method will get called back before they can receive any
      // PEER_AVAILABILITY_CHANGED events. But it gives me the hives to let random user code run
      // (via the callback) in the middle of our code. So I'm intentionally allowing the race condition
      // where as soon as the start method is called, but before the callback is called,
      // PEER_AVAILABILITY_CHANGED events can occur.
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
    self.thaliReplicationManager._emitter.removeListener(
      ThaliEmitter.events.PEER_AVAILABILITY_CHANGED,
      self.thaliEmitterListener
    );
  }

  self.connectionTable.cleanUp();
  self.connectionTable = null;

  self.largerHashStateMachine.stop();

  return identityExchangeUtils.stopThaliReplicationManager(
      self.thaliReplicationManager
    )
    .catch(function(err) {
      return err;
    }).then(function(err) {
      self.identityExchangeStateMachine.stopIdentityExchangeCalledCBDone();
      if (cb){
        cb(err);
      }
    });
}

function onExecuteIdentityExchangeCalled(
  event,
  from,
  to,
  self,
  peerIdentifier,
  otherPkHashBase64,
  cb) {
  if (!cb) {
    throw new Error('cb is required.');
  }

  var otherPkHashBuffer = urlSafeBase64.decode(otherPkHashBase64);

  self.codeListener = function(code) {
    cb(null, code);
  };

  self.smallerHashExitListener = function(err) {
    if (err !== SmallerHashStateMachine.ExitBecauseNotNeededError &&
        err !== SmallerHashStateMachine.ExitBecauseGotValidationCode) {
      self.smallerHashStateMachine.stopExecutingIdentityExchangeCalled(
        self,
        peerIdentifier
      );
      cb(err);
    }
  };

  self.smallerHashStateMachine = new SmallerHashStateMachine(
    self.thaliReplicationManager,
    self.connectionTable,
    peerIdentifier,
    otherPkHashBuffer,
    self.myPublicKeyHashBuffer,
    self.thaliServerPort,
    self.dbName,
    self.identityExchangeDeviceName
  );

  self.smallerHashStateMachine.on(
    SmallerHashStateMachine.Events.ValidationCode, self.codeListener
  );

  self.smallerHashStateMachine.once(
    SmallerHashStateMachine.Events.Exited,
    self.smallerHashExitListener
  );

  self.smallerHashStateMachine.start();

  self.largerHashStateMachine.on(
    LargerHashStateMachine.Events.ValidationCodeGenerated,
    self.codeListener
  );

  self.largerHashStateMachine.exchangeIdentity(otherPkHashBuffer);
}

function onStopExecutingIdentityExchangeCalled(event, from, to, self) {
  self.largerHashStateMachine.removeListener(
    LargerHashStateMachine.Events.ValidationCodeGenerated,
    self.codeListener
  );

  self.largerHashStateMachine.stop();

  self.smallerHashStateMachine.removeListener(
    SmallerHashStateMachine.Events.ValidationCode,
    self.codeListener
  );

  self.smallerHashStateMachine.removeListener(
    SmallerHashStateMachine.Events.Exited,
    self.smallerHashExitListener
  );

  self.smallerHashStateMachine.stop();
  self.smallerHashStateMachine = null;
}

IdentityExchange.prototype.startIdentityExchange = function(
  myFriendlyName,
  cb) {

  return this.identityExchangeStateMachine.startIdentityExchangeCalled(
    this,
    myFriendlyName,
    cb
  );
};

IdentityExchange.prototype.stopIdentityExchange = function(cb) {
  return this.identityExchangeStateMachine.stopIdentityExchangeCalled(this, cb);
};

IdentityExchange.prototype.executeIdentityExchange = function(
  peerIdentifier,
  otherPkHashBase64,
  cb) {

  return this.identityExchangeStateMachine.executeIdentityExchangeCalled(
    this,
    peerIdentifier,
    otherPkHashBase64,
    cb
  );
};

IdentityExchange.prototype.stopExecutingIdentityExchange = function() {
  return this.identityExchangeStateMachine.stopExecutingIdentityExchangeCalled(
    this
  );
};

function IdentityExchange(
  thaiApp,
  thaliServerPort,
  thaliReplicationManager,
  dbName) {

  EventEmitter.call(this);
  this.thaliApp = thaiApp;
  this.thaliServerPort = thaliServerPort;
  this.thaliReplicationManager = thaliReplicationManager;
  this.dbName = dbName;
  this.identityExchangeStateMachine = StateMachine.create({
    initial: 'wait',
    events: [{
      name: 'startIdentityExchangeCalled',
      from: 'wait',
      to: 'startIdentityExchangeCalledCB'
    }, {
      name: 'startIdentityExchangeCalledCBFail',
      from: 'startIdentityExchangeCalledCB',
      to: 'wait'
    }, {
      name: 'startIdentityExchangeCalledCBDone',
      from: 'startIdentityExchangeCalledCB',
      to: 'findPeersDoingIdentityExchange'
    }, {
      name: 'stopIdentityExchangeCalled',
      from: 'findPeersDoingIdentityExchange',
      to: 'stopIdentityExchangeCalledCB'
    }, {
      name: 'stopIdentityExchangeCalledCBDone',
      from: 'stopIdentityExchangeCalledCB',
      to: 'wait'
    }, {
      name: 'executeIdentityExchangeCalled',
      from: 'findPeersDoingIdentityExchange',
      to: 'exchangeIdentity'
    }, {
      name: 'stopExecutingIdentityExchangeCalled',
      from: 'exchangeIdentity',
      to: 'findPeersDoingIdentityExchange'
    }],
    callbacks: {
      onstartIdentityExchangeCalled: onStartIdentityExchangeCalled,
      onstopIdentityExchangeCalled: onStopIdentityExchangeCalled,
      onexecuteIdentityExchangeCalled: onExecuteIdentityExchangeCalled,
      onstopExecutingIdentityExchangeCalled: onStopExecutingIdentityExchangeCalled
    }
  });
}

module.exports = IdentityExchange;
