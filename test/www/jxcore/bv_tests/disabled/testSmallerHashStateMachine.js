'use strict';

var tape = require('../lib/thaliTape');
var SmallerHashStateMachine = require('thali/identityExchange/SmallerHashStateMachine');
var LargerHashStateMachine = require('thali/identityExchange/LargerHashStateMachine');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var nock = require('nock');
var crypto = require('crypto');
var identityExchangeUtils = require('thali/identityExchange/identityExchangeUtils');
var identityExchangeTestUtils = require('./identityExchangeTestUtils');
var ThaliReplicationManager = require('thali/thalireplicationmanager');
var urlSafeBase64 = require('urlsafe-base64');

var port = 10008;
var testServer = nock('http://localhost:' + port);
var bigHash = null;
var smallHash = null;
var thaliApp = null;
var thaliServer = null;
var thaliServerPort = null;
var thePeerId = null;
var smallerHashStateMachine = null;
var largerHashStateMachine = null;

var test = tape({
  setup: function(t) {
    thePeerId = '23po98r;lo23ihjfl;wijf;lwaijsf;loi3hjf;lashf;lohwass;klfihsa3;klifhas;kliefh;saklifhos389;alhf';
    var smallAndBigHash = identityExchangeTestUtils.createSmallAndBigHash();
    smallHash = smallAndBigHash.smallHash;
    bigHash = smallAndBigHash.bigHash;
    t.end();
  },
  teardown: function(t) {
    if (smallerHashStateMachine) {
      smallerHashStateMachine.stop();
    }

    if (largerHashStateMachine) {
      largerHashStateMachine.stop();
    }

    if (!testServer.isDone()) {
      testServer.cleanAll();
    }

    if (thaliServer) {
      thaliServer.close();
    }
    thaliApp = null;
    thaliServer = null;
    thaliServerPort = null;
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


function TRMMock() {
  EventEmitter.call(this);
}

inherits(TRMMock, EventEmitter);

TRMMock.prototype.start = function() {
  this.emit(ThaliReplicationManager.events.STARTED);
};
TRMMock.prototype.stop = function() {
  this.emit(ThaliReplicationManager.events.STOPPED);
};

function MockConnectionTable(lookUpPeerIdResponseFunction) {
  EventEmitter.call(this);
  this.lookUpPeerId = !lookUpPeerIdResponseFunction ?
    function() { return null; } :
    lookUpPeerIdResponseFunction;
}

inherits(MockConnectionTable, EventEmitter);

MockConnectionTable.prototype.lookUpPeerId = null;

function mockConnectionTableGenerator(t, expectedPeerId, portsArray) {
  if (!portsArray || portsArray.length <= 0) {
    throw new Error('portsArray must have at least one entry');
  }

  var responsesSent = -1;
  var mock = new MockConnectionTable(function(peerId, lastLookupTime) {
    t.equal(expectedPeerId, peerId);

    if (lastLookupTime === portsArray.length - 1) {
      t.end();
      return;
    }

    if (!lastLookupTime && responsesSent === -1 || lastLookupTime === responsesSent) {
      responsesSent += 1;
      var response = { muxPort: portsArray[responsesSent], time: responsesSent};
      if (responsesSent % 2 === 0) {
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

function endlessMockConnectionTableLoop(t, expectedPeerId, port, noChannelBindingErrors) {
  var lookupTime = 0;
  var mock = new MockConnectionTable(function(peerId, lastLookupTime) {
    t.equal(expectedPeerId, peerId);
    if (!noChannelBindingErrors) {
      t.pass('lookupTime: ' + lookupTime + ', lastLookupTime: ' + lastLookupTime);
      t.ok(lookupTime === 0 || lookupTime === lastLookupTime);
    }

    lookupTime += 1;
    var response = { muxPort: port, time: lookupTime };
    if (lookupTime % 2 === 0) {
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
  var pkOtherBase64 = urlSafeBase64.encode(bigHash);
  var goodRnOther = urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.rnBufferLength));
  return { rnOther: goodRnOther, pkOther: pkOtherBase64 };
}

function runBad200Test(t, requestPath, numberEvents) {
  smallerHashStateMachine =
    new SmallerHashStateMachine(new TRMMock(), endlessMockConnectionTableLoop(t, thePeerId, port), thePeerId,
      bigHash, smallHash);

  var bad200EventCount = 0;

  smallerHashStateMachine.on(SmallerHashStateMachine.Events.BadRequestBody, function(path) {
    t.equal(requestPath, path);
    bad200EventCount += 1;
    if (bad200EventCount === numberEvents) {
      t.end();
    }
  });

  smallerHashStateMachine.start();
}

test('start - Make sure we exit when our hash is bigger', function (t) {
  smallerHashStateMachine =
    new SmallerHashStateMachine(new TRMMock(), new MockConnectionTable(), null, smallHash, bigHash);
  smallerHashStateMachine.once(SmallerHashStateMachine.Events.Exited, function(error) {
    t.equal(error, SmallerHashStateMachine.ExitBecauseNotNeededError);
    t.equal(smallerHashStateMachine.smallHashStateMachine.current, 'Exit');
    t.end();
  });
  smallerHashStateMachine.start();
});

test('start - Make sure we start when our hash is smaller', function(t) {
  smallerHashStateMachine =
    new SmallerHashStateMachine(new TRMMock(), new MockConnectionTable(), null, bigHash, smallHash);
  smallerHashStateMachine.on(SmallerHashStateMachine.Events.SearchStarted, function() {
    t.equal(smallerHashStateMachine.smallHashStateMachine.current, 'GetPeerIdPort');
    t.end();
  });
  smallerHashStateMachine.start();
});

test('onFoundPeerPort - bad peer port', function(t) {
  var badPortMockTable = mockConnectionTableGenerator(t, thePeerId, [10101, 10101]);
  var smallerHashStateMachine =
    new SmallerHashStateMachine(new TRMMock(), badPortMockTable, thePeerId, bigHash, smallHash);
  smallerHashStateMachine.start();
});

test('200 cb responses with problem', function(t) {
  var pkOtherBase64 = urlSafeBase64.encode(bigHash);
  var goodRnOther = urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.rnBufferLength));
  var testArray = [
    {},
    { rnOther: '{abc', pkOther: pkOtherBase64 }, // rnOther isn't base 64 value
    { rnOther: urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.rnBufferLength + 2)),
      pkOther: pkOtherBase64},
    { rnOther: urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.rnBufferLength - 1)),
      pkOther: pkOtherBase64},
    { rnOther: goodRnOther },
    { rnOther: goodRnOther,
      pkOther: urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.pkBufferLength - 1)) },
    { rnOther: goodRnOther,
      pkOther: urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.pkBufferLength + 1)) },
    { rnOther: goodRnOther,
      pkOther: urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.pkBufferLength)) }
  ];

  var portArray = [];
  testArray.forEach(function(responseBody) {
    portArray.push(port);
    testServer
      .post(identityExchangeUtils.cbPath)
      .reply(200, responseBody);
  });

  runBad200Test(t, identityExchangeUtils.cbPath, testArray.length);
});

test('200 rnmine responses with problem', function(t) {
  var testArray = [
    {},
    { pkOther: '' },
    { pkOther: '{abc' },
    { pkOther: urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.pkBufferLength - 3)) },
    { pkOther: urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.pkBufferLength + 10)) },
    { pkOther: urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.pkBufferLength)) },
    { foo: 'ick'}
  ];

  var portArray = [];
  testArray.forEach(function(responseBody) {
    portArray.push(port);
    testServer
      .post(identityExchangeUtils.cbPath)
      .reply(200, goodCbMockResponse())
      .post(identityExchangeUtils.rnMinePath)
      .reply(200, responseBody);
  });

  runBad200Test(t, identityExchangeUtils.rnMinePath, testArray.length);
});

test('Just weird cb response error code,', function(t) {
  testServer
    .post(identityExchangeUtils.cbPath)
    .reply(500, {});
  smallerHashStateMachine =
    new SmallerHashStateMachine(new TRMMock(), endlessMockConnectionTableLoop(t, thePeerId, port),
      thePeerId, bigHash, smallHash);
  smallerHashStateMachine.on(SmallerHashStateMachine.Events.GotUnclassifiedError, function(path) {
    t.equal(path, identityExchangeUtils.cbPath);
    t.end();
  });
  smallerHashStateMachine.start();
});

test('Just weird rnmine response error code,', function(t) {
  testServer
    .post(identityExchangeUtils.cbPath)
    .reply(200, goodCbMockResponse)
    .post(identityExchangeUtils.rnMinePath)
    .reply(500, {});
  smallerHashStateMachine =
    new SmallerHashStateMachine(new TRMMock(), endlessMockConnectionTableLoop(t, thePeerId, port),
      thePeerId, bigHash, smallHash);
  smallerHashStateMachine.on(SmallerHashStateMachine.Events.GotUnclassifiedError, function(path) {
    t.equal(path, identityExchangeUtils.rnMinePath);
    t.end();
  });
  smallerHashStateMachine.start();
});

test('Handling 404 on cb response', function(t) {
  startThaliServer().then(function() {
    largerHashStateMachine = new LargerHashStateMachine(thaliApp, bigHash);
    smallerHashStateMachine =
      new SmallerHashStateMachine(new TRMMock(),
        endlessMockConnectionTableLoop(t, thePeerId, thaliServerPort), thePeerId, bigHash, smallHash);
    smallerHashStateMachine.on(SmallerHashStateMachine.Events.FourOhFour, function() {
      // We need to get rid of largerHashStateMachine because otherwise teardown will call stop
      // and we (intentionally) never called start!
      largerHashStateMachine = null;
      t.end();
    });
    smallerHashStateMachine.start();
  });
});

test('Handling 404 on rnmine response', function(t) {
  testServer
    .post(identityExchangeUtils.cbPath)
    .reply(200, goodCbMockResponse())
    .post(identityExchangeUtils.rnMinePath)
    .reply(404, "");
  var smallerHashStateMachine =
    new SmallerHashStateMachine(new TRMMock(), endlessMockConnectionTableLoop(t, thePeerId, port), thePeerId, bigHash,
      smallHash);
  smallerHashStateMachine.on(SmallerHashStateMachine.Events.FourOhFour, function() {
    smallerHashStateMachine.stop();
    t.end();
  });
  smallerHashStateMachine.start();
});

test('Handling 400 w/notDoingIdentityExchange on cb response', function(t) {
  startThaliServer().then(function() {
    largerHashStateMachine = new LargerHashStateMachine(thaliApp, bigHash);
    smallerHashStateMachine =
      new SmallerHashStateMachine(new TRMMock(),
        endlessMockConnectionTableLoop(t, thePeerId, thaliServerPort, true), thePeerId, bigHash, smallHash);
    smallerHashStateMachine.once(SmallerHashStateMachine.Events.GotNotDoingIdentityExchange, function(path) {
      t.equals(path, identityExchangeUtils.cbPath);
      largerHashStateMachine.exchangeIdentity(smallHash);
    });
    smallerHashStateMachine.once(SmallerHashStateMachine.Events.ValidationCode, function() {
      t.end();
    });
    largerHashStateMachine.start();
    smallerHashStateMachine.start();
  });
});

test('Handling 400 w/notDoingIdentityExchange on rnmine response', function(t) {
  startThaliServer().then(function() {
    largerHashStateMachine = new LargerHashStateMachine(thaliApp, bigHash);
    smallerHashStateMachine =
      new SmallerHashStateMachine(new TRMMock(),
        endlessMockConnectionTableLoop(t, thePeerId, thaliServerPort, true),
        thePeerId, bigHash, smallHash);
    smallerHashStateMachine.once(SmallerHashStateMachine.Events.GoodCbRequest, function() {
      largerHashStateMachine.stop();
    });
    smallerHashStateMachine.once(SmallerHashStateMachine.Events.GotNotDoingIdentityExchange, function(path) {
      t.equals(path, identityExchangeUtils.rnMinePath);
      largerHashStateMachine.exchangeIdentity(smallHash);
    });
    smallerHashStateMachine.once(SmallerHashStateMachine.Events.ValidationCode, function() {
      t.end();
    });
    largerHashStateMachine.start();
    largerHashStateMachine.exchangeIdentity(smallHash);
    smallerHashStateMachine.start();
  });
});

test('Handling 400 w/wrongPeer on cb response', function(t) {
  startThaliServer().then(function() {
    largerHashStateMachine = new LargerHashStateMachine(thaliApp, bigHash);
    smallerHashStateMachine =
      new SmallerHashStateMachine(new TRMMock(),
        retrySamePortConnectionTable(thePeerId, t, true), thePeerId, bigHash, smallHash);
    largerHashStateMachine.start();
    largerHashStateMachine.exchangeIdentity(crypto.randomBytes(identityExchangeUtils.pkBufferLength));
    smallerHashStateMachine.on(SmallerHashStateMachine.Events.WrongPeer, function() {
      smallerHashStateMachine.stop();
      t.end();
    });
    smallerHashStateMachine.start();
  });
});

test('Get to success!', function(t) {
  var smallerValidationCode = null;
  var largerValidationCode = null;
  var exitCalled = null;

  function checkDone() {
    if (smallerValidationCode && largerValidationCode && exitCalled) {
      t.equal(smallerValidationCode, largerValidationCode);
      t.end();
    }
  }
  startThaliServer().then(function() {
    largerHashStateMachine = new LargerHashStateMachine(thaliApp, bigHash);
    smallerHashStateMachine =
      new SmallerHashStateMachine(new TRMMock(),
        retrySamePortConnectionTable(thePeerId, t, true), thePeerId, bigHash, smallHash);
    largerHashStateMachine.start();
    largerHashStateMachine.exchangeIdentity(smallHash);
    smallerHashStateMachine.on(SmallerHashStateMachine.Events.Exited, function(error) {
      if (exitCalled) {
        return t.fail('We should only have been called here once.');
      }
      exitCalled = true;
      t.equal(error, SmallerHashStateMachine.ExitBecauseGotValidationCode);
      checkDone();
    });
    smallerHashStateMachine.on(SmallerHashStateMachine.Events.ValidationCode, function(validationCode) {
      if (smallerValidationCode) {
        return t.fail('We should have only gotten called here once');
      }
      smallerValidationCode = validationCode;
      checkDone();
    });
    largerHashStateMachine.on(LargerHashStateMachine.Events.ValidationCodeGenerated, function (validationCode) {
      if (largerValidationCode) {
        return t.fail('We should have only gotten called here once');
      }
      largerValidationCode = validationCode;
      checkDone();
    });
    smallerHashStateMachine.start();
  });
});

test('Test race conditions', function(t) {
  smallerHashStateMachine = new SmallerHashStateMachine(new TRMMock(),
    retrySamePortConnectionTable(thePeerId, t), thePeerId, bigHash, smallHash);
  smallerHashStateMachine.start();
  setImmediate(function() {
    smallerHashStateMachine.stop();
    t.throws(function() { smallerHashStateMachine.start(); });
    t.end();
  });
});


// TEST TO WRITE
// Check when happens when the thali replication manager does a bad start or bad stop, my hope is that
// we won't need this test because we will implement issue #135
