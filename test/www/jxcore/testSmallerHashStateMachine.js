'use strict';

var tape = require('wrapping-tape');
var SmallerHashStateMachine = require('thali/identityExchange/SmallerHashStateMachine');
var LargerHashStateMachine = require('thali/identityExchange/LargerHashStateMachine');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Nock = require('nock');
var crypto = require('crypto');
var identityExchangeUtils = require('thali/identityExchange/identityExchangeUtils');
var identityExchangeTestUtils = require('./identityExchangeTestUtils');

var port = 10008;
var testServer = Nock('http://localhost:' + port);
var bigHash = null;
var smallHash = null;
var thaliApp = null;
var thaliServer = null;
var thaliServerPort = null;
var thePeerId = null;

// test setup & teardown activities
var test = tape({
    setup: function(t) {
        thePeerId = "23po98r;lo23ihjfl;wijf;lwaijsf;loi3hjf;lashf;lohwass;klfihsa3;klifhas;kliefh;saklifhos389;alhf";
        var random1 = crypto.randomBytes(identityExchangeUtils.pkBufferLength);
        var random2 = crypto.randomBytes(identityExchangeUtils.pkBufferLength);
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

        if (thaliServer) {
            thaliServer.close();
            thaliApp = null;
            thaliServer = null;
            thaliServerPort = null;
        }

        t.end();
    }
});

/**
 * This can take anywhere from up to 14 seconds to run and that's on the desktop, so we only
 * run it when we need it.
 * @returns {*}
 */
function startThaliServer() {
    return identityExchangeTestUtils.createThaliAppServer()
        .then(function(appAndServer) {
            thaliApp = appAndServer.app;
            thaliServer = appAndServer.server;
            thaliServerPort = thaliServer.address().port;
        });
}

inherits(MockConnectionTable, EventEmitter);
function MockConnectionTable(lookUpPeerIdResponseFunction) {
    EventEmitter.call(this);
    this.lookUpPeerId = !lookUpPeerIdResponseFunction ?
            function() { return null; } :
            lookUpPeerIdResponseFunction;
}

MockConnectionTable.prototype.lookUpPeerId = null;

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

function endlessMockConnectionTableLoop(t, expectedPeerId, port) {
    var lookupTime = 0;
    var mock = new MockConnectionTable(function(peerId, lastLookupTime) {
        t.equal(expectedPeerId, peerId);
        t.ok(lookupTime == 0 || lookupTime == lastLookupTime);

        lookupTime += 1;
        var response = { muxPort: port, time: lookupTime };
        if (lookupTime % 2 == 0) {
            setTimeout(function() {
                mock.emit(expectedPeerId, response);
            }, 10);
            return null;
        } else {
            return response;
        }
    });

    return mock;
}

function retrySamePortConnectionTable(thePeerId, t, failOnSecondRequest) {
    var pastFirst = false;
    return new MockConnectionTable(function(peerId, lastLookupTime) {
        t.equal(peerId, thePeerId);
        t.notOk(lastLookupTime);
        if (!pastFirst) {
            pastFirst = true;
            return { muxPort: thaliServerPort, time: 0};
        }
        if (failOnSecondRequest){
            t.fail();
            return null;
        }
        t.end();
        return null;
    });
}

function goodCbMockResponse() {
    var pkOtherBase64 = bigHash.toString('base64');
    var goodRnOther = crypto.randomBytes(identityExchangeUtils.rnBufferLength).toString('base64');
    return { rnOther: goodRnOther, pkOther: pkOtherBase64 };
}

//test('start - Make sure we exit when our hash is bigger', function (t) {
//    var stateMachineInExit =
//        new SmallerHashStateMachine(null, new MockConnectionTable(), null, smallHash, bigHash);
//    stateMachineInExit.on(SmallerHashStateMachine.Events.Exited, function() {
//        t.equal(stateMachineInExit.smallHashStateMachine.current, "Exit");
//        t.end();
//    });
//    stateMachineInExit.start();
//});
//
//function runBad200Test(t, requestPath, numberEvents) {
//    var stateMachine =
//        new SmallerHashStateMachine(null, endlessMockConnectionTableLoop(t, thePeerId, port), thePeerId, bigHash,
//            smallHash);
//
//    var bad200EventCount = 0;
//
//    stateMachine.on(SmallerHashStateMachine.Events.BadRequestBody, function(path) {
//        t.equal(requestPath, path);
//        bad200EventCount += 1;
//        if (bad200EventCount == numberEvents) {
//            stateMachine.stop();
//            t.end();
//        }
//    });
//
//    stateMachine.start();
//}
//
//test('start - Make sure we start when our hash is smaller', function(t) {
//    var stateMachineStarting =
//        new SmallerHashStateMachine(null, new MockConnectionTable(), null, bigHash, smallHash);
//    stateMachineStarting.on(SmallerHashStateMachine.Events.SearchStarted, function() {
//        t.equal(stateMachineStarting.smallHashStateMachine.current, "GetPeerIdPort");
//        t.end();
//    });
//    stateMachineStarting.start();
//});
//
//test('onFoundPeerPort - bad peer port', function(t) {
//    var badPortMockTable = mockConnectionTableGenerator(t, thePeerId, [10101, 10101]);
//    var stateMachineBadPeerPort =
//       new SmallerHashStateMachine(null, badPortMockTable, thePeerId, bigHash, smallHash);
//    stateMachineBadPeerPort.start();
//});
//
//test('200 cb responses with problem', function(t) {
//    var pkOtherBase64 = bigHash.toString('base64');
//    var goodRnOther = crypto.randomBytes(identityExchangeUtils.rnBufferLength).toString('base64');
//    var testArray = [
//        {},
//        { rnOther: "{abc", pkOther: pkOtherBase64 }, // rnOther isn't base 64 value
//        { rnOther: crypto.randomBytes(identityExchangeUtils.rnBufferLength + 2).toString('base64'),
//            pkOther: pkOtherBase64},
//        { rnOther: crypto.randomBytes(identityExchangeUtils.rnBufferLength - 1).toString('base64'),
//            pkOther: pkOtherBase64},
//        { rnOther: goodRnOther },
//        { rnOther: goodRnOther,
//            pkOther: crypto.randomBytes(identityExchangeUtils.pkBufferLength - 1).toString('base64')},
//        { rnOther: goodRnOther,
//            pkOther: crypto.randomBytes(identityExchangeUtils.pkBufferLength + 1).toString('base64')},
//        { rnOther: goodRnOther,
//            pkOther: crypto.randomBytes(identityExchangeUtils.pkBufferLength).toString('base64')}
//    ];
//
//    var portArray = [];
//    testArray.forEach(function(responseBody) {
//        portArray.push(port);
//        testServer
//            .post(identityExchangeUtils.cbPath)
//            .reply(200, responseBody);
//    });
//
//    runBad200Test(t, identityExchangeUtils.cbPath, testArray.length);
//});
//
//test('200 rnmine responses with problem', function(t) {
//    var testArray = [
//        {},
//        { pkOther: "" },
//        { pkOther: "{abc" },
//        { pkOther: crypto.randomBytes(identityExchangeUtils.pkBufferLength - 3).toString('base64')},
//        { pkOther: crypto.randomBytes(identityExchangeUtils.pkBufferLength + 10).toString('base64')},
//        { pkOther: crypto.randomBytes(identityExchangeUtils.pkBufferLength).toString('base64')},
//        { foo: "ick"}
//    ];
//
//    var portArray = [];
//    testArray.forEach(function(responseBody) {
//       portArray.push(port);
//        testServer
//            .post(identityExchangeUtils.cbPath)
//            .reply(200, goodCbMockResponse())
//            .post(identityExchangeUtils.rnMinePath)
//            .reply(200, responseBody);
//    });
//
//    runBad200Test(t, identityExchangeUtils.rnMinePath, testArray.length);
//});
//
//test('Just weird cb response error code,', function(t) {
//    testServer
//        .post(identityExchangeUtils.cbPath)
//        .reply(500, {});
//    var stateMachine =
//        new SmallerHashStateMachine(null, mockConnectionTableGenerator(t, thePeerId, [port]),
//            thePeerId, bigHash, smallHash);
//    stateMachine.start();
//});
//
//test('Just weird rnmine response error code,', function(t) {
//    testServer
//        .post(identityExchangeUtils.cbPath)
//        .reply(200, goodCbMockResponse)
//        .post(identityExchangeUtils.rnMinePath)
//        .reply(500, {});
//    var stateMachine =
//        new SmallerHashStateMachine(null, mockConnectionTableGenerator(t, thePeerId, [port]),
//            thePeerId, bigHash, smallHash);
//    stateMachine.start();
//});
//
//
//test('Handling 404 on cb response', function(t) {
//    startThaliServer().then(function() {
//        var largerHashStateMachine = new LargerHashStateMachine(thaliApp, bigHash);
//        var smallerHashStateMachine =
//            new SmallerHashStateMachine(null,
//                endlessMockConnectionTableLoop(t, thePeerId, thaliServerPort), thePeerId, bigHash, smallHash);
//        smallerHashStateMachine.on(SmallerHashStateMachine.Events.FourOhFour, function() {
//            smallerHashStateMachine.stop();
//            t.end();
//        });
//        smallerHashStateMachine.start();
//    });
//});
//
//test('Handling 404 on rnmine response', function(t) {
//   testServer
//       .post(identityExchangeUtils.cbPath)
//       .reply(200, goodCbMockResponse())
//       .post(identityExchangeUtils.rnMinePath)
//       .reply(404, "");
//    var stateMachine =
//        new SmallerHashStateMachine(null, endlessMockConnectionTableLoop(t, thePeerId, port), thePeerId, bigHash,
//            smallHash);
//    stateMachine.on(SmallerHashStateMachine.Events.FourOhFour, function() {
//        stateMachine.stop();
//        t.end();
//    });
//    stateMachine.start();
//});
//
//test('Handling 400 w/notDoingIdentityExchange on cb response', function(t) {
//    startThaliServer().then(function() {
//        var largerHashStateMachine = new LargerHashStateMachine(thaliApp, bigHash);
//        var smallerHashStateMachine =
//            new SmallerHashStateMachine(null,
//                retrySamePortConnectionTable(thePeerId, t), thePeerId, bigHash, smallHash);
//        largerHashStateMachine.start();
//        smallerHashStateMachine.start();
//    })
//});

test('Handling 400 w/notDoingIdentityExchange on rnmine response', function(t) {
    startThaliServer().then(function() {
        var largerHashStateMachine = new LargerHashStateMachine(thaliApp, bigHash);
        var smallerHashStateMachine =
            new SmallerHashStateMachine(null, endlessMockConnectionTableLoop(t, thePeerId, thaliServerPort),
                thePeerId, bigHash, smallHash);
        smallerHashStateMachine.on(SmallerHashStateMachine.Events.GoodCbRequest, function() {
            largerHashStateMachine.stop();
        });
        largerHashStateMachine.start();
        largerHashStateMachine.exchangeIdentity(smallHash);
        smallerHashStateMachine.start();
    })
});

test('Handling 400 w/wrongPeer on cb response', function(t) {
    startThaliServer().then(function() {
        var largerHashStateMachine = new LargerHashStateMachine(thaliApp, bigHash);
        var smallerHashStateMachine =
            new SmallerHashStateMachine(null,
                retrySamePortConnectionTable(thePeerId, t, true), thePeerId, bigHash, smallHash);
        largerHashStateMachine.start();
        largerHashStateMachine.exchangeIdentity(crypto.randomBytes(identityExchangeUtils.pkBufferLength), bigHash);
        smallerHashStateMachine.on(SmallerHashStateMachine.Events.WrongPeer, function() {
            t.end();
        });
        smallerHashStateMachine.start();
    })
});
