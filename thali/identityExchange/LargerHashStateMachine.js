'use strict';

var StateMachine = require("javascript-state-machine");
var crypto = require('crypto');
var express = require('express');
var bodyParser = require('body-parser');

var logger = require('../thalilogger')('largerHash');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var identityUtils = require('./identityExchangeUtils');


LargerHashStateMachine.Events = {
    Exited: "exit",
    OpenedHailingFrequencies: "serverConfigured"
};

inherits(LargerHashStateMachine, EventEmitter);

LargerHashStateMachine.prototype.largerHashStateMachine = null;
LargerHashStateMachine.prototype.lhsmRouter = null;
LargerHashStateMachine.prototype.thaliExpressServer = null;
LargerHashStateMachine.prototype.otherPkHashBuffer = null;
LargerHashStateMachine.prototype.myPkHashBuffer = null;
LargerHashStateMachine.prototype.myPkHashBase64 = null;

function startListening(event, from, to, self) {
    self.lhsmRouter = express.Router();
    var jsonParser = bodyParser.json();
    self.lhsmRouter.post('/cb', jsonParser, function(req, res) {
        return cbParser(self, req, res);
    });

    self.thaliExpressServer.use('/identity', self.lhsmRouter);
}

function fourHundredResponse(self, errorCode) {
    return {
        errorCode: errorCode,
        pkOther: self.myPkHashBase64
    }
}

function isCbRequestSyntacticallyValid(self, req) {
    if (!req.body) {
        logger.info("Got a cb request with no body!");
        return false;
    }

    var cbValueBuffer = identityUtils.validateCbAndGetBase64Object(req.body.cbValue);
    var pkMineBuffer = identityUtils.validatePkAndGetBase64Object(req.body.pkMine);

    if (!cbValueBuffer || !pkMineBuffer) {
        logger.info("Got a cb request with either a bum cbValue or pkMine or both - " +
            JSON.stringify(req.body));
        return false;
    }

    return true;
}

function cbParser(self, req, res) {
    switch (self.largerHashStateMachine.current) {
        case 'NoIdentityExchange':
            return res
                    .status(400)
                    .json(fourHundredResponse(self, identityUtils.fourHundredErrorCodes.notDoingIdentityExchange))
                    .end();
        case 'WrongPeer':
            return res
                .status(400)
                .json(fourHundredResponse(self, identityUtils.fourHundredErrorCodes.wrongPeer))
                .end();
        case 'WaitForCb':
            if (!isCbRequestSyntacticallyValid(self, req)) {
                return res
                    .status(400)
                    .json(fourHundredResponse(self, identityUtils.fourHundredErrorCodes.malformed))
                    .end();
            }
            return;
        default:
            logger.error("We got a CB request while in an illegal state!!!! Current State: " +
                self.largerHashStateMachine.current);
            return res.status(500).end();
    }
}

LargerHashStateMachine.prototype.stop = function() {
    return this.largerHashStateMachine.noIdentityExchange();
};

LargerHashStateMachine.prototype.exchangeIdentity = function(otherPkHashBuffer) {
    this.otherPkHashBuffer = otherPkHashBuffer;

    if (this.myPkHashBuffer.compare(this.otherPkHashBuffer) < 0) {
        this.largerHashStateMachine.desiredPeerHasLargerHash();
    } else {
        this.largerHashStateMachine.waitForPeer();
    }
};

LargerHashStateMachine.prototype.start = function() {
    this.largerHashStateMachine.startListening(this);
};

function LargerHashStateMachine(thaliExpressServer, myPkHashBuffer) {
    EventEmitter.call(this);
    var self = this;
    self.myPkHashBuffer = myPkHashBuffer;
    self.myPkHashBase64 = myPkHashBuffer.toString('base64');
    self.thaliExpressServer = thaliExpressServer;
    self.largerHashStateMachine = StateMachine.create({
        initial: 'none',
        events: [
            { name: 'startListening', from: 'none', to: 'NoIdentityExchange'},
            { name: 'desiredPeerHasLargerHash', from: 'NoIdentityExchange', to: 'WrongPeer'},
            { name: 'waitForPeer', from: 'NoIdentityExchange', to: 'WaitForCb'},
            { name: 'noIdentityExchange', from: ['NoIdentityExchange', 'WaitForCb', 'WrongPeer'],
                to: 'NoIdentityExchange'}
        ],
        callbacks: {
            onstartListening: startListening
        }
    });
}

module.exports = LargerHashStateMachine;