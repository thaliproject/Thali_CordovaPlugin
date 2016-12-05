'use strict';

/*
 This code isn't going to make sense if you haven't read
 http://www.goland.org/coinflippingforthali/ and
 http://www.goland.org/thaliidentityexchangeprotocol/. This implementation
 uses a state machine defined below based on (but not identical to) the larger
 hash state machine defined in the second link. Once this machine is
 associated with a replication manager it has to stay associated forever.
 This is because Express does not have (an officially supported) way to remove
 middleware. So the machine can be started, stopped and started again.

 One really confusing aspect of this machine is that I haven't defined the
 states in such a way that one is guaranteed to only be able to do
 start->exchangeIdentity->stop. For example, there is at least one path that
 goes from start->stop->exchangeIdentity. Also when the constructor is run
 the machine starts in the 'none' state (it literally does nothing) but once
 start is called even once there is no way to get back to 'none'. Yes, this
 could all be fixed but in practice it doesn't seem to matter.
*/

var StateMachine = require('javascript-state-machine');
var crypto = require('crypto');
var express = require('express');
var bodyParser = require('body-parser');

var logger = require('../../ThaliLogger')('largerHash');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var identityExchangeUtils = require('./identityExchangeUtils');
var urlSafeBase64 = require('urlsafe-base64');

LargerHashStateMachine.Events = {
  ValidationCodeGenerated: 'validationCodeGenerated'
};

inherits(LargerHashStateMachine, EventEmitter);

LargerHashStateMachine.prototype.largerHashStateMachine = null;
LargerHashStateMachine.prototype.lhsmRouter = null;
LargerHashStateMachine.prototype.thaliExpressServer = null;
LargerHashStateMachine.prototype.otherPkHashBuffer = null;
LargerHashStateMachine.prototype.myPkHashBuffer = null;
LargerHashStateMachine.prototype.myPkHashBase64 = null;
LargerHashStateMachine.prototype.rnMineBuffer = null;
LargerHashStateMachine.prototype.cbValueBuffer = null;

function startListening(event, from, to, self) {
  if (!self.lhsmRouter) {
    self.lhsmRouter = express.Router();
    var jsonParser = bodyParser.json();

    self.lhsmRouter.post('/cb', jsonParser, function(req, res) {
      return cbParser(self, req, res);
    });

    self.lhsmRouter.post('/rnmine', jsonParser, function(req, res) {
      return rnMineParser(self, req, res);
    });

    self.thaliExpressServer.use('/identity', self.lhsmRouter);
  }
}

function fourHundredResponse(self, res, errorCode) {
  return res
    .status(400)
    .json({
      errorCode: errorCode,
      pkOther: self.myPkHashBase64
    })
    .end();
}

function noIdentityExchangeResponse(self, res) {
  return fourHundredResponse(
    self,
    res,
    identityExchangeUtils.fourHundredErrorCodes.notDoingIdentityExchange
  );
}

function wrongPeerResponse(self, res) {
  return fourHundredResponse(
    self,
    res,
    identityExchangeUtils.fourHundredErrorCodes.wrongPeer
  );
}

function skipAheadResponse(self, res) {
  return fourHundredResponse(
    self,
    res,
    identityExchangeUtils.fourHundredErrorCodes.skippedAhead
  );
}

function malformedResponse(self, res) {
  return fourHundredResponse(
    self,
    res,
    identityExchangeUtils.fourHundredErrorCodes.malformed
  );
}

function isRequestSyntacticallyValid(req, path) {
  if (!req.body) {
    logger.info('Got a ' + path + ' request with no body!');
    return null;
  }

  var pkMineBuffer = identityExchangeUtils.validatePkAndGetBase64Object(
    req.body.pkMine
  );

  if (!pkMineBuffer) {
    logger.info('Got a ' + path + ' request with a bum pkMine - ' +
      JSON.stringify(req.body));
    return null;
  }

  return pkMineBuffer;
}

function isCbRequestSyntacticallyValid (req) {
  var pkMineBuffer = isRequestSyntacticallyValid(
    req, identityExchangeUtils.cbPath
  );

  if (!pkMineBuffer) { return null; }

  var cbValueBuffer =
  identityExchangeUtils.validateCbAndGetBase64Object(req.body.cbValue);

  if (!cbValueBuffer) {
    logger.info('Got a cb request with a bum cbValue - ' +
      JSON.stringify(req.body));
    return null;
  }

  return { cbValueBuffer: cbValueBuffer, pkMineBuffer: pkMineBuffer };
}

function cbParser(self, req, res) {
  switch (self.largerHashStateMachine.current) {
    case 'NoIdentityExchange':
      return noIdentityExchangeResponse(self, res);
    case 'WrongPeer':
      return wrongPeerResponse(self, res);
    case 'WaitForCb':
    case 'WaitForRnMine':
      var cbAndpkMineBuffers = isCbRequestSyntacticallyValid(req);
      if (!cbAndpkMineBuffers) {
        return malformedResponse(self, res);
      }

      if (identityExchangeUtils.compareEqualSizeBuffers(
        cbAndpkMineBuffers.pkMineBuffer,
        self.otherPkHashBuffer) !== 0) {

        return wrongPeerResponse(self, res);
      }

      self.cbValueBuffer = cbAndpkMineBuffers.cbValueBuffer;
      self.rnMineBuffer = crypto.randomBytes(
        identityExchangeUtils.rnBufferLength
      );
      self.largerHashStateMachine.waitForRnMine();

      return res
        .status(200)
        .json({
          rnOther: urlSafeBase64.encode(self.rnMineBuffer),
          pkOther: self.myPkHashBase64
        })
        .end();
    default:
      logger.error('We got a CB request while in an illegal state!!!! Current State: ' + self.largerHashStateMachine.current);
      return res.status(500).end();
  }
}

function isRnMineRequestSyntacticallyValid(req) {
  var pkMineBuffer = isRequestSyntacticallyValid(
    req,
    identityExchangeUtils.rnMinePath
  );

  if (!pkMineBuffer) {
    return null;
  }

  var rnMineBuffer = identityExchangeUtils.validateRnAndGetBase64Object(
    req.body.rnMine
  );

  if (!rnMineBuffer) {
    logger.info('Got a rnmind request with either a rnMine - ' +
      JSON.stringify(req.body));
    return null;
  }

  return { rnMineBuffer: rnMineBuffer, pkMineBuffer: pkMineBuffer };
}

function rnMineParser(self, req, res) {
  switch (self.largerHashStateMachine.current) {
    case 'NoIdentityExchange':
      return noIdentityExchangeResponse(self, res);
    case 'WrongPeer':
      return wrongPeerResponse(self, res);
    case 'WaitForCb':
      return skipAheadResponse(self, res);
    case 'WaitForRnMine':
      var rnAndPkMineBuffers = isRnMineRequestSyntacticallyValid(req);
      if (!rnAndPkMineBuffers) {
        return malformedResponse(self, res);
      }

      if (identityExchangeUtils.compareEqualSizeBuffers(
        rnAndPkMineBuffers.pkMineBuffer,
        self.otherPkHashBuffer) !== 0) {

        return wrongPeerResponse(self, res);
      }

      var rnOtherBuffer = rnAndPkMineBuffers.rnMineBuffer;

      var testCbValueBuffer = identityExchangeUtils.generateCb(
        rnOtherBuffer,
        self.otherPkHashBuffer,
        self.myPkHashBuffer
      );

      if (identityExchangeUtils.compareEqualSizeBuffers(
        self.cbValueBuffer,
        testCbValueBuffer) !== 0) {

        return malformedResponse(self, res);
      }

      self.emit(
        LargerHashStateMachine.Events.ValidationCodeGenerated,
        identityExchangeUtils.generateValidationCode(
          self.rnMineBuffer,
          self.myPkHashBuffer,
          self.otherPkHashBuffer, rnOtherBuffer)
      );

      return res
        .status(200)
        .json({
          pkOther: self.myPkHashBase64
        })
        .end();
    default:
      logger.error('We got a rnMine request while in an illegal state!!!! Current State: ' + self.largerHashStateMachine.current);
      return res.status(500).end();
  }
}

LargerHashStateMachine.prototype.stop = function() {
  return this.largerHashStateMachine.noIdentityExchange();
};

LargerHashStateMachine.prototype.exchangeIdentity = function(
  otherPkHashBuffer) {

  this.otherPkHashBuffer = otherPkHashBuffer;

  if (identityExchangeUtils.compareEqualSizeBuffers(
    this.myPkHashBuffer,
    this.otherPkHashBuffer) < 0) {

    this.largerHashStateMachine.desiredPeerHasLargerHash();
  } else {
    this.largerHashStateMachine.waitForCb();
  }
};

LargerHashStateMachine.prototype.start = function() {
  this.largerHashStateMachine.startListening(this);
};

function LargerHashStateMachine(thaliExpressServer, myPkHashBuffer) {
  EventEmitter.call(this);
  var self = this;
  self.myPkHashBuffer = myPkHashBuffer;
  self.myPkHashBase64 = urlSafeBase64.encode(myPkHashBuffer);
  self.thaliExpressServer = thaliExpressServer;
  self.largerHashStateMachine = StateMachine.create({
    initial: 'none',
    events: [{
      name: 'startListening',
      from: ['none', 'NoIdentityExchange'],
      to: 'NoIdentityExchange'
    }, {
      name: 'desiredPeerHasLargerHash',
      from: 'NoIdentityExchange',
      to: 'WrongPeer'
    }, {
      name: 'waitForCb',
      from: 'NoIdentityExchange',
      to: 'WaitForCb'
    }, {
      name: 'noIdentityExchange',
      from: ['NoIdentityExchange', 'WaitForCb', 'WrongPeer', 'WaitForRnMine'],
      to: 'NoIdentityExchange'
    }, {
      name: 'waitForRnMine',
      from: ['WaitForCb', 'WaitForRnMine'],
      to: 'WaitForRnMine'
    }],
    callbacks: {
      onstartListening: startListening
    }
  });
}

module.exports = LargerHashStateMachine;
