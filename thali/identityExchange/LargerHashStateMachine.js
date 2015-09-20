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

function exitCalled(self) {

}

function fourHundredResponse(self, errorCode) {
    return {
        errorCode: errorCode,
        pkOther: self.myPkHashBase64
    }
}

function isCbRequestValid(self, req) {
    if (!req.body) {
        logger.info("Got a cb request with no body!");
        return false;
    }

    var cbValueBuffer = identityUtils.validateCbAndGetBase64Object(req.cbValue);
    var pkMineBuffer = identityUtils.validateAndGetBase64Object(req.pkMine);

    if (!cbValueBuffer || !pkMineBuffer) {
        logger.info("Got a cb request with either a bum cbValue or pkMine or both - " +
            JSON.stringify(req.body));
        return false;
    }

    return self.otherPkHashBuffer.compare(self.myPkHashBuffer) === 0;
}

function cbParser(self, req, res) {
    if (!isCbRequestValid(self, req)) {
        return res
            .stats(400)
            .json(fourHundredResponse(self, identityUtils.fourHundredErrorCodes.malformed))
            .end();
    }

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
        case 'Exit':
            logger.info("We got a CB request while in Exit state, that should not be possible!");
            return res.status(500).end();
        default:
            return res.status(500).end();
    }
}

LargerHashStateMachine.prototype.stop = function() {
    return this.largerHashStateMachine.exitCalled(self);
};

function lhsmRouter(self) {
    self.lhsmRouter = express.Router();
    var jsonParser = bodyParser.json();
    self.lhsmRouter.post('/cb', jsonParser, function(req, res) {
        return cbParser(self, req, res);
    });
    return self.lhsmRouter;
}

LargerHashStateMachine.prototype.start = function() {
    this.thaliExpressServer.use('/identity', lhsmRouter(this));
    if (this.myPkHashBuffer.compare(this.otherPkHashBuffer)   > 0) {
        this.largerHashStateMachine.desiredPeerHasLargerHash(this);
    } else {
        this.largerHashStateMachine.startListening(this);
    }
};

function LargerHashStateMachine(thaliExpressServer, otherPkHashBuffer, myPkHashBuffer) {
    EventEmitter.call(this);
    var self = this;
    self.thaliExpressServer = thaliExpressServer;
    self.otherPkHashBuffer = otherPkHashBuffer;
    self.myPkHashBuffer = myPkHashBuffer;
    self.myPkHashBase64 = myPkHashBuffer.toString('base64');
    self.largerHashStateMachine = StateMachine.create({
        initial: 'NoIdentityExchange',
        events: [
            { name: 'startListening', from: 'NoIdentityExchange', to: 'WaitForCb'},
            { name: 'desiredPeerHasLargerHash', from: 'NoIdentityExchange', to: 'WrongPeer'},
            { name: 'exitCalled', from: ['NoIdentityExchange', 'WaitForCb', 'WrongPeer'],
                to: 'Exit'}
        ],
        callbacks: {
            onexitCalled: exitCalled
        }
    });
}

module.exports = LargerHashStateMachine;