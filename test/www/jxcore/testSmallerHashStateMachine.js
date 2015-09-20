'use strict';

var tape = require('wrapping-tape');
var SmallerHashStateMachine = require('thali/identityExchange/SmallerHashStateMachine');
var LargerHashStateMachine = require('thali/identityExchange/LargerHashStateMachine');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Nock = require('nock');
var crypto = require('crypto');
var identityUtils = require('thali/identityExchange/identityExchangeUtils');
var identityExchangeTestUtils = require('./identityExchangeTestUtils');


var port = 10007;
var testServer = Nock('http://localhost:' + port);
var bigHash = null;
var smallHash = null;

// test setup & teardown activities
var test = tape({
    setup: function(t) {
        var random1 = crypto.randomBytes(identityUtils.rnBufferLength);
        var random2 = crypto.randomBytes(identityUtils.rnBufferLength);
        if (random1.compare(random2) > 0) {
            bigHash = random1;
            smallHash = random2;
        } else {
            bigHash = random2;
            smallHash = random1;
        }
        t.end();
    },
    teardown: function(t) {
        if (!testServer.isDone()) {
            testServer.cleanAll();
        }
        t.end();
    }
});

inherits(MockConnectionTable, EventEmitter);
function MockConnectionTable(lookUpPeerIdResponseFunction) {
    EventEmitter.call(this);
    this.lookUpPeerId = !lookUpPeerIdResponseFunction ?
            function() { return null; } :
            lookUpPeerIdResponseFunction;
}

MockConnectionTable.prototype.lookUpPeerId = null;

test('start - Make sure we exit when our hash is bigger', function (t) {
    var stateMachineInExit =
        new SmallerHashStateMachine(null, new MockConnectionTable(), null, smallHash, bigHash);
    stateMachineInExit.on(SmallerHashStateMachine.Events.Exited, function() {
        t.equal(stateMachineInExit.smallHashStateMachine.current, "Exit");
        t.end();
    });
    stateMachineInExit.start();
});

test('start - Make sure we start when our hash is smaller', function(t) {
    var stateMachineStarting =
        new SmallerHashStateMachine(null, new MockConnectionTable(), null, bigHash, smallHash);
    stateMachineStarting.on(SmallerHashStateMachine.Events.SearchStarted, function() {
        t.equal(stateMachineStarting.smallHashStateMachine.current, "GetPeerIdPort");
        t.end();
    });
    stateMachineStarting.start();
});

function mockConnectionTableGenerator(t, expectedPeerId, portsArray) {
    if (!portsArray || portsArray.length <= 0) {
        throw new Error("portsArray must have at least one entry");
    }

    var responsesSent = -1;
    var mock = new MockConnectionTable(function(peerId, lastLookupTime) {
        t.equal(expectedPeerId, peerId);

        if (lastLookupTime == portsArray.length - 1) {
            t.end();
            return;
        }

        if ((!lastLookupTime && responsesSent == -1) || lastLookupTime == responsesSent) {
            responsesSent += 1;
            var response = { muxPort: portsArray[responsesSent], time: responsesSent};
            if (responsesSent % 2 == 0) {
                setTimeout(function() {
                    mock.emit(expectedPeerId, response);
                }, 10);
                return null;
            } else {
                return response;
            }
        }

        t.fail();
    });

    return mock;
}

test('onFoundPeerPort - bad peer port', function(t) {
    var thePeerId = "foo";
    var badPortMockTable = mockConnectionTableGenerator(t, thePeerId, [10101, 10101]);
    var stateMachineBadPeerPort =
       new SmallerHashStateMachine(null, badPortMockTable, thePeerId, bigHash, smallHash);
    stateMachineBadPeerPort.start();
});

test('200 cb responses with problem', function(t) {
    var thePeerId = "a;sldjf;lskdajf;lksajf;leaiwsjf;leiasjf;lisaehjf;lisaehf;leashf;ilhase;lfihase;lfihsae;f";
    var pkOtherBase64 = bigHash.toString('base64');
    var goodRnOther = crypto.randomBytes(identityUtils.rnBufferLength).toString('base64');
    var testArray = [
        {},
        { rnOther: "{abc", pkOther: pkOtherBase64 }, // rnOther isn't base 64 value
        { rnOther: crypto.randomBytes(identityUtils.rnBufferLength + 2).toString('base64'),
            pkOther: pkOtherBase64},
        { rnOther: crypto.randomBytes(identityUtils.rnBufferLength - 1).toString('base64'),
            pkOther: pkOtherBase64},
        { rnOther: goodRnOther },
        { rnOther: goodRnOther,
            pkOther: crypto.randomBytes(identityUtils.pkBufferLength - 1).toString('base64')},
        { rnOther: goodRnOther,
            pkOther: crypto.randomBytes(identityUtils.pkBufferLength + 1).toString('base64')},
        { rnOther: goodRnOther,
            pkOther: crypto.randomBytes(identityUtils.pkBufferLength).toString('base64')}
    ];
    var portArray = [];
    testArray.forEach(function(responseBody) {
        portArray.push(port);
        testServer
            .post('/identity/cb')
            .reply(200, responseBody);
    });

    var syncMock = mockConnectionTableGenerator(t, thePeerId, portArray);

    var stateMachine =
        new SmallerHashStateMachine(null, syncMock, thePeerId, bigHash, smallHash);
    stateMachine.start();
});

test('Just weird cb response error code,', function(t) {
    var thePeerId = ";asljf;laskjf;laskjfn;elosafuaw;o389uyrf;aow8y3f;o8aw3yfw";
    testServer
        .post('/identity/cb')
        .reply(500, {});
    var stateMachine =
        new SmallerHashStateMachine(null, mockConnectionTableGenerator(t, thePeerId, [port]),
            thePeerId, bigHash, smallHash);
    stateMachine.start();
});


test('Handling 404 on cb response', function(t) {
    identityExchangeTestUtils.createThaliAppServer()
    .then(function(app, server) {
        var largerHashStateMachine = new LargerHashStateMachine(app, bigHash, smallHash);
        largerHashStateMachine.start();
        largerHashStateMachine.stop();
    });

});
// status code 404
// status code 400 w/ notDoingIdentityExchnage
// status code 400 w/ wrongPeer
// status code 200 no problem
