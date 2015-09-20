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
    SearchStarted: "searchStarted"
};

inherits(SmallerHashStateMachine, EventEmitter);

SmallerHashStateMachine.prototype.identityExchangeController = null;
SmallerHashStateMachine.prototype.connectionTable = null;
SmallerHashStateMachine.prototype.peerIdentifier = null;
SmallerHashStateMachine.prototype.otherPkHashBuffer = null;
SmallerHashStateMachine.prototype.myPkHashBuffer = null;
SmallerHashStateMachine.prototype.portListener = null;

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
    self.emit(SmallerHashStateMachine.Events.Exited);
}




function onFoundPeerPort(event, from, to, self, port, portRetrievalTime) {
    var rnMineBuffer = crypto.randomBytes(identityExchangeUtils.rnBufferLength);
    var cbValueBase64 =
        generateCb(rnMineBuffer, self.myPkHashBuffer, self.otherPkHashBuffer).toString('base64');
    var cbPath = "/identity/cb";

    logger.info("Making " + cbPath + " request to pkOther value " + self.otherPkHashBuffer);
    self.currentHttpRequest = request.post({
        url: 'http://localhost:' + port + cbPath,
        body: {
            cbValue: cbValueBase64,
            pkMine: self.myPkHashBuffer.toString('base64')
        },
        json: true
    }, function (error, response, body) {
        self.currentHttpRequest = null;
        if (self.smallHashStateMachine.current !== 'MakeCbRequest') {
            logger.error("Oops, we aren't in MakeCbRequest anymore, we should have been aborted, " +
                " we should be in the exit state and we are in " +
                self.smallHashStateMachine.current);
            return;
        }

        if (error) {
            logger.info("Got error creating request to " + cbPath + " : " + JSON.stringify(error));
            self.smallHashStateMachine.channelBindingError(self, portRetrievalTime);
            return;
        }

        if (response.statusCode == 200) {
            var rnOtherBuffer = identityExchangeUtils.validateRnAndGetBase64Object(body.rnOther);
            var pkOtherBuffer = identityExchangeUtils.validatePkAndGetBase64Object(body.pkOther);

            if (!rnOtherBuffer || !pkOtherBuffer || self.otherPkHashBuffer.compare(pkOtherBuffer) !== 0) {
                logger.info("Got bad or missing rnOther or pkOther value or wrong pkOther " +
                    JSON.stringify(body));
                logger.info("Got channel binding error");
                self.smallHashStateMachine.channelBindingError(self, portRetrievalTime);
                return;
            } else {
                logger.info("cbRequest Succeeded!");
                self.smallHashStateMachine.cbRequestSucceeded(self, rnMineBuffer, rnOtherBuffer);
                return;
            }
        }

        if (response.statusCode == 404 ||
            (response.statusCode == 400 &&
             body.errorCode == identityExchangeUtils.fourHundredErrorCodes.notDoingIdentityExchange)) {
            logger.info("Got identity exchange not started");
            self.smallHashStateMachine.identityExchangeNotStarted(self);
            return;
        }

        if (response.statusCode == 400 &&
            body.errorCode == identityExchangeUtils.fourHundredErrorCodes.wrongPeer) {
            logger.info("Got wrongPeer Error!");
            self.cb(new Error("Got wrongPeer Error"));
            self.smallHashStateMachine.exitCalled(self);
            return;
        }

        logger.info("We got some other error, specifically " + response.statusCode + ", body - " +
            body);
        self.smallHashStateMachine.channelBindingError(self, portRetrievalTime);
    });
}

function onIdentityExchangeNotStarted(event, from, to, self) {

}

function onCbRequestSucceeded(event, from, to, self, rnMineBuffer, rnOtherBuffer) {

}

function onChannelBindingError(event, from, to, self, portRetrievalTime) {
    return getPeerIdPort(self, portRetrievalTime);
}

function generateCb(rnMine, myPkHashBuffer, otherPkHashBuffer) {
    var concatHash = Buffer.concat([myPkHashBuffer, otherPkHashBuffer]);
    var cbHash = crypto.createHmac('sha256', rnMine);
    return cbHash.update(concatHash);
}

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
                from: ['none', 'GetPeerIdPort', 'MakeCbRequest', 'WaitForIdentityExchangeToStart', 'MakeRnMineRequest'],
                to: 'Exit'},
            { name: 'foundPeerPort', from: 'GetPeerIdPort', to: 'MakeCbRequest'},
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