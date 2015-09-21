'use strict';

var StateMachine = require("javascript-state-machine");
var crypto = require('crypto');
var request = require('request');
var logger = require('../thalilogger')('smallerHash');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var identityExchangeUtils = require('./identityExchangeUtils');

SmallerHashStateMachine.Events = {
    Exited: "exit",
    SearchStarted: "searchStarted",
    WrongPeer: "wrongPeer",
    ValidationCode: "validationCode",
    BadRequestBody: "testBad200",
    FourOhFour: "test404NotFound",
    GoodCbRequest: "testGoodCbRequest"
};

inherits(SmallerHashStateMachine, EventEmitter);

SmallerHashStateMachine.prototype.identityExchangeController = null;
SmallerHashStateMachine.prototype.connectionTable = null;
SmallerHashStateMachine.prototype.peerIdentifier = null;
SmallerHashStateMachine.prototype.otherPkHashBuffer = null;
SmallerHashStateMachine.prototype.myPkHashBuffer = null;
SmallerHashStateMachine.prototype.portListener = null;
SmallerHashStateMachine.prototype.onIdentityExchangeNotStartedTimeout = null;

SmallerHashStateMachine.prototype.smallHashStateMachine = null;
SmallerHashStateMachine.prototype.currentHttpRequest = null;

function getPeerIdPort(self, portRetrievalTime) {
    var tableEntry = self.connectionTable.lookUpPeerId(self.peerIdentifier, portRetrievalTime);
    if (!tableEntry) {
        self.portListener = function(tableEntry) {
            self.smallHashStateMachine.foundPeerPort(self, tableEntry.muxPort, tableEntry.time);
        };
        self.connectionTable.once(self.peerIdentifier, self.portListener);
    } else {
        self.smallHashStateMachine.foundPeerPort(self, tableEntry.muxPort, tableEntry.time);
    }
}

function onStartSearch(event, from, to, self) {
    self.emit(SmallerHashStateMachine.Events.SearchStarted);
    getPeerIdPort(self);
}

function onExitCalled(event, from, to, self) {
    if (self.currentHttpRequest) {
        self.currentHttpRequest.abort();
    }

    if (self.portListener) {
        self.connectionTable.removeListener(self.peerIdentifier, self.portListener);
    }

    if (self.onIdentityExchangeNotStartedTimeout) {
        clearTimeout(self.onIdentityExchangeNotStartedTimeout);
    }

    self.emit(SmallerHashStateMachine.Events.Exited);
}

function makeRequestParseResponse(self, port, portRetrievalTime, urlPath, requestBody, state, validate200) {
    logger.info("Making " + urlPath + " request to pkOther value " + self.otherPkHashBuffer);
    self.currentHttpRequest = request.post({
        url: 'http://localhost:' + port + urlPath,
        body: requestBody,
        json: true
    }, function (error, response, body) {
        self.currentHttpRequest = null;
        if (self.smallHashStateMachine.current !== state) {
            logger.error("Oops, we aren't in " + state + " anymore, we should have been aborted, " +
                " we should be in the exit state and we are in " +
                self.smallHashStateMachine.current);
            return;
        }

        if (error) {
            logger.info("Got error creating request to " + urlPath + " with port " + port +
                " : " + JSON.stringify(error));
            self.smallHashStateMachine.channelBindingError(self, portRetrievalTime);
            return;
        }

        if (response.statusCode == 404) {
            logger.info("Got a 404 in response to a "+ urlPath + " request");
            self.smallHashStateMachine.identityExchangeNotStarted(self);
            self.emit(SmallerHashStateMachine.Events.FourOhFour);
            return;
        }

        if (response.statusCode == 200 || response.statusCode == 400) {
            if (!body) {
                logger.info("We didn't get a response body from a " + urlPath + " response with status " +
                    response.statusCode);
                self.smallHashStateMachine.channelBindingError(self, portRetrievalTime);
                self.emit(SmallerHashStateMachine.Events.BadRequestBody, urlPath);
                return;
            }

            var pkOtherBuffer = identityExchangeUtils.validatePkAndGetBase64Object(body.pkOther);
            if (!pkOtherBuffer) {
                logger.info("We didn't get a pkOther value from a " + urlPath + " response with status " +
                    response.statusCode);
                self.smallHashStateMachine.channelBindingError(self, portRetrievalTime);
                self.emit(SmallerHashStateMachine.Events.BadRequestBody, urlPath);
                return;
            }

            if (self.otherPkHashBuffer.compare(pkOtherBuffer) !== 0) {
                logger.info("Got the wrong pkOther value from a " + urlPath + " response with status " +
                    response.statusCode);
                self.smallHashStateMachine.channelBindingError(self, portRetrievalTime);
                self.emit(SmallerHashStateMachine.Events.BadRequestBody, urlPath);
                return;
            }

            if (response.statusCode == 200) {
                return validate200(body);
            }

            switch (body.errorCode) {
                case identityExchangeUtils.fourHundredErrorCodes.wrongPeer:
                    logger.info("Got wrongPeer Error on " + urlPath + " response.");
                    self.smallHashStateMachine.exitCalled(self);
                    self.emit(SmallerHashStateMachine.Events.WrongPeer);
                    return;
                case identityExchangeUtils.fourHundredErrorCodes.notDoingIdentityExchange:
                    logger.info("Got identity exchange not started on " + urlPath + " response.");
                    self.smallHashStateMachine.identityExchangeNotStarted(self);
                    return;
            }
        }

        logger.info("We got some other error, specifically " + response.statusCode + ", body - " +
            (!body ? null : body));
        self.smallHashStateMachine.channelBindingError(self, portRetrievalTime);
    });
}

function onFoundPeerPort(event, from, to, self, port, portRetrievalTime) {
    var rnMineBuffer = crypto.randomBytes(identityExchangeUtils.rnBufferLength);
    var cbValueBase64 =
        generateCb(rnMineBuffer, self.myPkHashBuffer, self.otherPkHashBuffer).toString('base64');
    var requestBody =  {
        cbValue: cbValueBase64,
        pkMine: self.myPkHashBuffer.toString('base64')
    };
    var validate200 = function(body) {
        var rnOtherBuffer = identityExchangeUtils.validateRnAndGetBase64Object(body.rnOther);

        if (!rnOtherBuffer) {
            logger.info("We didn't get a legal rnOther value from a 200 cb response");
            self.smallHashStateMachine.channelBindingError(self, portRetrievalTime);
            self.emit(SmallerHashStateMachine.Events.BadRequestBody, identityExchangeUtils.cbPath);
            return;
        }

        logger.info("cbRequest Succeeded!");
        self.smallHashStateMachine.cbRequestSucceeded(self, port, portRetrievalTime, rnMineBuffer, rnOtherBuffer);
        self.emit(SmallerHashStateMachine.Events.GoodCbRequest);
    };
    return makeRequestParseResponse(self, port, portRetrievalTime, identityExchangeUtils.cbPath, requestBody,
                                    "MakeCbRequest", validate200);
}

function onIdentityExchangeNotStarted(event, from, to, self) {
    self.onIdentityExchangeNotStartedTimeout = setTimeout(function() {
        getPeerIdPort(self);
    }, 100);
}

function onCbRequestSucceeded(event, from, to, self, port, portRetrievalTime, rnMineBuffer, rnOtherBuffer) {
    var requestBody = {
        rnMine: rnMineBuffer.toString('base64'),
        pkMine: self.myPkHashBuffer.toString('base64')
    };
    var validate200 = function() {
        self.smallHashStateMachine.exitCalled(self);
        self.emit(SmallerHashStateMachine.Events.ValidationCode, generateValidationCode(rnMineBuffer,
            rnOtherBuffer, self.myPkHashBuffer, self.otherPkHashBuffer));
    };
    return makeRequestParseResponse(self, port, portRetrievalTime, identityExchangeUtils.rnMinePath, requestBody,
                                    "MakeRnMineRequest", validate200);
}

function onChannelBindingError(event, from, to, self, portRetrievalTime) {
    return getPeerIdPort(self, portRetrievalTime);
}

function generateHashBuffer(arrayOfBuffers, key) {
    var buffer = Buffer.concat(arrayOfBuffers);
    var hash = crypto.createHmac('sha256', key);
    hash.write(buffer);
    hash.end();
    return hash.read();
}

function generateCb(rnMine, myPkHashBuffer, otherPkHashBuffer) {
    return generateHashBuffer([ myPkHashBuffer, otherPkHashBuffer], rnMine);
}

function generateValidationCode(rnMine, rnOther, myPkHashBuffer, otherPkHashBuffer) {
    var hashBuffer = generateHashBuffer([ otherPkHashBuffer, myPkHashBuffer, rnMine], rnOther);
    return parseInt(hashBuffer.toString('hex'), 16) % Math.pow(10, 6);
}

SmallerHashStateMachine.prototype.stop = function() {
    if (this.smallHashStateMachine.current != "Exit") {
        return this.smallHashStateMachine.exitCalled(this);
    }
};

SmallerHashStateMachine.prototype.start = function() {
    if (this.myPkHashBuffer.compare(this.otherPkHashBuffer) > 0) {
        this.smallHashStateMachine.exitCalled(this);
    } else {
        this.smallHashStateMachine.startSearch(this);
    }
};

function SmallerHashStateMachine(identityExchangeController, connectionTable, peerIdentifier, otherPkHashBuffer,
                               myPkHashBuffer) {
    EventEmitter.call(this);
    this.identityExchangeController = identityExchangeController;
    this.connectionTable = connectionTable;
    this.peerIdentifier = peerIdentifier;
    this.otherPkHashBuffer = otherPkHashBuffer;
    this.myPkHashBuffer = myPkHashBuffer;
    this.smallHashStateMachine = StateMachine.create({
        initial: 'none',
        events: [
            { name: 'startSearch', from: 'none', to: 'GetPeerIdPort'},
            { name: 'exitCalled',
                from: ['none', 'GetPeerIdPort', 'MakeCbRequest', 'WaitForIdentityExchangeToStart',
                       'MakeRnMineRequest', 'Exit'],
                to: 'Exit'},
            { name: 'foundPeerPort', from: ['GetPeerIdPort', 'WaitForIdentityExchangeToStart'], to: 'MakeCbRequest'},
            { name: 'identityExchangeNotStarted', from: ['MakeCbRequest', 'MakeRnMineRequest'],
                to: 'WaitForIdentityExchangeToStart'},
            { name: 'cbRequestSucceeded', from: 'MakeCbRequest', to: 'MakeRnMineRequest'},
            { name: 'channelBindingError', from: ['MakeCbRequest', 'MakeRnMineRequest'], to: 'GetPeerIdPort'}
        ],
        callbacks: {
            onstartSearch: onStartSearch,
            onexitCalled: onExitCalled,
            onfoundPeerPort: onFoundPeerPort,
            onidentityExchangeNotStarted: onIdentityExchangeNotStarted,
            oncbRequestSucceeded: onCbRequestSucceeded,
            onchannelBindingError: onChannelBindingError
        }
    });
}

module.exports = SmallerHashStateMachine;