'use strict';

var tape = require('../lib/thaliTape');
var LargerHashStateMachine = require('thali/identityExchange/LargerHashStateMachine');
var identityExchangeUtils = require('thali/identityExchange/identityExchangeUtils');
var identityExchangeTestUtils = require('./identityExchangeTestUtils');
var request = require('supertest-as-promised');
var crypto = require('crypto');
var urlSafeBase64 = require('urlsafe-base64');

var thePeerId = null;
var smallHash = null;
var bigHash = null;
var smallHashBase64 = null;
var bigHashBase64 = null;
var thaliApp = null;
var thaliServer = null;
var thaliServerPort = null;
var largerHashStateMachine = null;

function setUpServer() {
  return identityExchangeTestUtils.createThaliAppServer()
    .then(function(appAndServer) {
      thaliApp = appAndServer.app;
      thaliServer = appAndServer.server;
      thaliServerPort = thaliServer.address().port;
      largerHashStateMachine = new LargerHashStateMachine(thaliApp, bigHash);
    }).catch(function(err) {
      throw err;
    });
}

var test = tape({
  setup: function(t) {
    thePeerId = "This is a really long string or it would be if I just kept typing on and on forever and ever without nothing useful to say.";
    var smallAndBigHash = identityExchangeTestUtils.createSmallAndBigHash();
    smallHash = smallAndBigHash.smallHash;
    smallHashBase64 = urlSafeBase64.encode(smallHash);
    bigHash = smallAndBigHash.bigHash;
    bigHashBase64 = urlSafeBase64.encode(bigHash);
    setUpServer().then(function() {
      t.end();
    });
  },
  teardown: function(t) {
    if (largerHashStateMachine) {
      largerHashStateMachine.stop();
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

function passed(t) {
  return function(err, res) {
    t.notOk(err);
    t.end();
  };
}

function valFourHundred(t, errorCode, pkOther) {
  return function(res) {
    t.equal(res.body.errorCode, errorCode);
    t.equal(res.body.pkOther, pkOther);
  };
}

function wrongPeerTest(path, t) {
  thaliServer.close(function() {
    setUpServer().then(function() {
      largerHashStateMachine = new LargerHashStateMachine(thaliApp, smallHash);
      largerHashStateMachine.start();
      largerHashStateMachine.exchangeIdentity(bigHash);
      t.equal(largerHashStateMachine.largerHashStateMachine.current, 'WrongPeer');
      request(thaliApp)
        .post(path)
        .expect(400)
        .expect(valFourHundred(t, identityExchangeUtils.fourHundredErrorCodes.wrongPeer, smallHashBase64))
        .end(passed(t));
    });
  });
}

function goodFakeCb() {
  return {
    cbValue: urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.cbBufferLength)),
    pkMine: urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.pkBufferLength))
  };
}

function goodFakeRnMine() {
  return {
    rnMine: urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.rnBufferLength)),
    pkOther: urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.pkBufferLength))
  };
}

function createCb(cbValue, pkMine) {
  return {
    cbValue: !cbValue ? urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.cbBufferLength)) :
      cbValue,
    pkMine: !pkMine ? urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.pkBufferLength)) :
      pkMine
  };
}

function createRnMine(rnMine, pkMine) {
  return {
    rnMine: !rnMine ? urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.rnBufferLength)) :
      rnMine,
    pkMine: !pkMine ? urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.pkBufferLength)) :
      pkMine
  };
}

function makeGoodCb(rnMineBuffer) {
  return request(thaliApp)
    .post(identityExchangeUtils.cbPath)
    .send(
    createCb(urlSafeBase64.encode(identityExchangeUtils.generateCb(rnMineBuffer, smallHash, bigHash)),
      smallHashBase64))
    .expect(200);
}

function makeGoodRnMine(rnMineBuffer) {
  return request(thaliApp)
    .post(identityExchangeUtils.rnMinePath)
    .send(createRnMine(urlSafeBase64.encode(rnMineBuffer), smallHashBase64))
    .expect(200);
}

function makeBadTestValues(cryptoValueLength) {
  return [" ", "{@#{$@#{$", urlSafeBase64.encode(crypto.randomBytes(cryptoValueLength + 1)),
    urlSafeBase64.encode(crypto.randomBytes(cryptoValueLength - 1))];
}

function makeArrayOfBadRequestBodies(firstCryptoLength, secondCryptoLength, messageCreationFunction) {
  var firstBadValueArray = makeBadTestValues(firstCryptoLength);
  var secondBadValueArray = makeBadTestValues(secondCryptoLength);
  var testArray = [];

  firstBadValueArray.forEach(function(badFirstValue) {
    testArray.push(messageCreationFunction(badFirstValue));
  });

  secondBadValueArray.forEach(function(badSecondValue) {
    testArray.push(messageCreationFunction(null, badSecondValue));
  });

  firstBadValueArray.forEach(function(badFirstValue) {
    secondBadValueArray.forEach(function(badSecondValue) {
      testArray.push(messageCreationFunction(badFirstValue, badSecondValue));
    });
  });

  testArray.push({});

  return testArray;
}

test('Make sure we return 404 before hitting start', function(t) {
  request(thaliApp)
    .post(identityExchangeUtils.cbPath)
    .send({ foo: "bar" })
    .expect(404)
    .end(function(err, res) {
      t.notOk(err);
      largerHashStateMachine = null; // No need to call stop in teardown since we didn't call start
      t.end();
    });
});

test('Random path after start, need 404', function(t) {
  largerHashStateMachine.start();
  request(thaliApp)
    .post("/identity/foobar")
    .send({ foo: "bar"})
    .expect(404)
    .end(passed(t));
});

test('Confirm we go to wrongPeer if our hash is smaller', function(t) {
  wrongPeerTest(identityExchangeUtils.cbPath, t);
});

test('Confirm we go to wrongPeer if our hash is smaller', function(t) {
  wrongPeerTest(identityExchangeUtils.rnMinePath, t);
});

test('Confirm we get wrongPeer on cb if we give hash other than expected', function(t) {
  largerHashStateMachine.start();
  largerHashStateMachine.exchangeIdentity(smallHash);
  request(thaliApp)
    .post(identityExchangeUtils.cbPath)
    .send(goodFakeCb())
    .expect(400)
    .expect(valFourHundred(t, identityExchangeUtils.fourHundredErrorCodes.wrongPeer, bigHashBase64))
    .end(passed(t));
});

test('Confirm we get Skip Ahead even with a wrong peer on a rnMine request (and we can argue if this is a good choice)',
  function(t) {
    largerHashStateMachine.start();
    largerHashStateMachine.exchangeIdentity(smallHash);
    request(thaliApp)
      .post(identityExchangeUtils.rnMinePath)
      .send(goodFakeRnMine())
      .expect(400)
      .expect(valFourHundred(t, identityExchangeUtils.fourHundredErrorCodes.skippedAhead, bigHashBase64))
      .end(passed(t));
  });

test('NoIdentityExchange after start & stop', function(t) {
  largerHashStateMachine.start();
  request(thaliApp)
    .post(identityExchangeUtils.cbPath)
    .send(goodFakeCb())
    .expect(400)
    .expect(valFourHundred(t, identityExchangeUtils.fourHundredErrorCodes.notDoingIdentityExchange, bigHashBase64))
    .end(t.notOk);

  request(thaliApp)
    .post(identityExchangeUtils.rnMinePath)
    .send(goodFakeRnMine())
    .expect(400)
    .expect(valFourHundred(t, identityExchangeUtils.fourHundredErrorCodes.notDoingIdentityExchange, bigHashBase64))
    .end(t.notOk);

  largerHashStateMachine.exchangeIdentity(smallHash);
  largerHashStateMachine.stop();

  request(thaliApp)
    .post(identityExchangeUtils.cbPath)
    .send(goodFakeCb())
    .expect(400)
    .expect(valFourHundred(t, identityExchangeUtils.fourHundredErrorCodes.notDoingIdentityExchange, bigHashBase64))
    .end(t.notOk);

  request(thaliApp)
    .post(identityExchangeUtils.rnMinePath)
    .send(goodFakeRnMine())
    .expect(400)
    .expect(valFourHundred(t, identityExchangeUtils.fourHundredErrorCodes.notDoingIdentityExchange, bigHashBase64))
    .end(passed(t));
});

test('cbRequest - bad request bodies', function(t) {
  var testArray = makeArrayOfBadRequestBodies(identityExchangeUtils.cbBufferLength,
    identityExchangeUtils.pkBufferLength, createCb);

  largerHashStateMachine.start();
  largerHashStateMachine.exchangeIdentity(smallHash);

  var requestCounter = 0;

  function exitOnCount(err, res) {
    t.notOk(err);
    requestCounter += 1;
    if (requestCounter === testArray.length) {
      t.end();
    }
  }

  testArray.forEach(function(testBody){
    request(thaliApp)
      .post(identityExchangeUtils.cbPath)
      .send(testBody)
      .expect(400)
      .expect(valFourHundred(t, identityExchangeUtils.fourHundredErrorCodes.malformed, bigHashBase64))
      .end(exitOnCount);
  });
});

test('re-do cb (to check we can reset) and make sure rnOther changes', function(t) {
  largerHashStateMachine.start();
  largerHashStateMachine.exchangeIdentity(smallHash);
  var firstRnOther;
  var realRnMineBuffer = crypto.randomBytes(identityExchangeUtils.rnBufferLength);
  request(thaliApp)
    .post(identityExchangeUtils.cbPath)
    .send(createCb(urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.cbBufferLength)), smallHashBase64))
    .expect(200)
    .then(function(res) {
      t.ok(res.body.rnOther);
      firstRnOther = res.body.rnOther;
      t.equal(res.body.pkOther, bigHashBase64);

      return makeGoodCb(realRnMineBuffer);
    }).then(function(res) {
      t.notEqual(firstRnOther, res.body.rnOther);
      t.equal(res.body.pkOther, bigHashBase64);

      return makeGoodRnMine(realRnMineBuffer);
    }).then(function(res) {
      t.equal(res.body.pkOther, bigHashBase64);
      t.end();
    }).catch(function(err) {
      t.fail(err);
    });
});

test('good cb followed by good rnmine then repeat cb and finish up, make sure we have new rnOther', function(t) {
  var firstRnMineBuffer = crypto.randomBytes(identityExchangeUtils.rnBufferLength);
  var secondRnMineBuffer = crypto.randomBytes(identityExchangeUtils.rnBufferLength);
  var firstRnOther = null;
  var secondRnOther = null;
  var seenFirstValidationCode = false;
  largerHashStateMachine.on(LargerHashStateMachine.Events.ValidationCodeGenerated, function(code) {
    if (!seenFirstValidationCode) {
      seenFirstValidationCode = true;
      return;
    }
    var secondRnOtherBuffer = identityExchangeUtils.validateRnAndGetBase64Object(secondRnOther);
    t.ok(secondRnOtherBuffer);
    t.equal(code,
      identityExchangeUtils.generateValidationCode(secondRnOtherBuffer, bigHash, smallHash, secondRnMineBuffer));
    t.end();
  });
  largerHashStateMachine.start();
  largerHashStateMachine.exchangeIdentity(smallHash);
  makeGoodCb(firstRnMineBuffer)
    .then(function(res) {
      t.ok(res.body.rnOther);
      firstRnOther = res.body.rnOther;

      return makeGoodRnMine(firstRnMineBuffer);
    }).then(function(res) {
      return makeGoodCb(secondRnMineBuffer);
    }).then(function(res) {
      t.notEqual(res.body.rnOther, firstRnOther);
      secondRnOther = res.body.rnOther;

      return makeGoodRnMine(secondRnMineBuffer);
    }).catch(function(err) {
      t.fail(err);
    });
});

test('do a successful cb and successful rnmine and then repeat the rnmine', function(t) {
  var rnMineBuffer = crypto.randomBytes(identityExchangeUtils.rnBufferLength);
  var seenFirstValidationCode = false;
  var rnOther = null;
  largerHashStateMachine.on(LargerHashStateMachine.Events.ValidationCodeGenerated, function(code) {
    if (!seenFirstValidationCode) {
      seenFirstValidationCode = true;
      return;
    }
    var rnOtherBuffer = identityExchangeUtils.validateRnAndGetBase64Object(rnOther);
    t.ok(rnOtherBuffer);
    t.equal(code,
      identityExchangeUtils.generateValidationCode(rnOtherBuffer, bigHash, smallHash, rnMineBuffer));
    t.end();
  });
  largerHashStateMachine.start();
  largerHashStateMachine.exchangeIdentity(smallHash);
  makeGoodCb(rnMineBuffer)
    .then(function(res) {
      t.ok(res.body.rnOther);
      rnOther = res.body.rnOther;

      return makeGoodRnMine(rnMineBuffer);
    }).then(function(res) {
      return makeGoodRnMine(rnMineBuffer);
    }).catch(function(err) {
      t.fail(err);
    });
});

test('do a rnmine without a cb', function(t) {
  largerHashStateMachine.start();
  largerHashStateMachine.exchangeIdentity(smallHash);
  return request(thaliApp)
    .post(identityExchangeUtils.rnMinePath)
    .send(createRnMine(null, smallHashBase64))
    .expect(400)
    .expect(valFourHundred(t, identityExchangeUtils.fourHundredErrorCodes.skippedAhead, bigHashBase64))
    .end(passed(t));
});

test('rnMine - bad request bodies', function(t) {
  var testArray = makeArrayOfBadRequestBodies(identityExchangeUtils.rnBufferLength,
    identityExchangeUtils.pkBufferLength, createRnMine);

  largerHashStateMachine.start();
  largerHashStateMachine.exchangeIdentity(smallHash);

  var requestCounter = 0;

  testArray.forEach(function(testBody){
    request(thaliApp)
      .post(identityExchangeUtils.cbPath)
      .send(createCb(null, smallHashBase64))
      .expect(200)
      .then(function(res) {
        return request(thaliApp)
          .post(identityExchangeUtils.rnMinePath)
          .send(testBody)
          .expect(400)
          .expect(valFourHundred(t, identityExchangeUtils.fourHundredErrorCodes.malformed, bigHashBase64));
      }).then(function(res) {
        requestCounter += 1;
        if (requestCounter === testArray.length) {
          t.end();
        }
      }).catch(function(err) {
        t.fail(err);
      });
  });
});

test("do a cb and then a wrong peer and then finish with rnmine, make sure state didn't get lost", function(t) {
  var rnMineBuffer = crypto.randomBytes(identityExchangeUtils.rnBufferLength);
  var rnOther = null;
  largerHashStateMachine.on(LargerHashStateMachine.Events.ValidationCodeGenerated, function(code) {
    var rnOtherBuffer = identityExchangeUtils.validateRnAndGetBase64Object(rnOther);
    t.ok(rnOtherBuffer);
    t.equal(code,
      identityExchangeUtils.generateValidationCode(rnOtherBuffer, bigHash, smallHash, rnMineBuffer));
    t.end();
  });
  largerHashStateMachine.start();
  largerHashStateMachine.exchangeIdentity(smallHash);
  makeGoodCb(rnMineBuffer)
    .then(function(res) {
      t.ok(res.body.rnOther);
      rnOther = res.body.rnOther;

      return request(thaliApp)
        .post(identityExchangeUtils.cbPath)
        .send(createCb(null, null))
        .expect(400)
        .expect(valFourHundred(t, identityExchangeUtils.fourHundredErrorCodes.wrongPeer, bigHashBase64));
    }).then(function(res) {
      return makeGoodRnMine(rnMineBuffer);
    }).catch(function(err) {
      t.fail(err);
    });
});

test("do a cb and then a rnmine then a wrong peer then repeat rnmine to make sure state didn't get lost", function(t) {
  var rnMineBuffer = crypto.randomBytes(identityExchangeUtils.rnBufferLength);
  var rnOther = null;
  var seenFirstValidationCode = false;
  largerHashStateMachine.on(LargerHashStateMachine.Events.ValidationCodeGenerated, function(code) {
    if (!seenFirstValidationCode) {
      seenFirstValidationCode = true;
      return;
    }
    var rnOtherBuffer = identityExchangeUtils.validateRnAndGetBase64Object(rnOther);
    t.ok(rnOtherBuffer);
    t.equal(code,
      identityExchangeUtils.generateValidationCode(rnOtherBuffer, bigHash, smallHash, rnMineBuffer));
    t.end();
  });
  largerHashStateMachine.start();
  largerHashStateMachine.exchangeIdentity(smallHash);
  makeGoodCb(rnMineBuffer)
    .then(function(res) {
      t.ok(res.body.rnOther);
      rnOther = res.body.rnOther;

      return makeGoodRnMine(rnMineBuffer);
    }).then(function(res) {
      return request(thaliApp)
        .post(identityExchangeUtils.cbPath)
        .send(createCb(null, null))
        .expect(400)
        .expect(valFourHundred(t, identityExchangeUtils.fourHundredErrorCodes.wrongPeer, bigHashBase64));
    }).then(function(res) {
      return request(thaliApp)
        .post(identityExchangeUtils.rnMinePath)
        .send(createRnMine(null, null))
        .expect(400)
        .expect(valFourHundred(t, identityExchangeUtils.fourHundredErrorCodes.wrongPeer, bigHashBase64));
    }).then(function(res) {
      return makeGoodRnMine(rnMineBuffer);
    }).catch(function(err) {
      t.fail(err);
    });
});

test("do a cb and then a rnmine with a rnmine that doesn't match the cb value", function(t) {
  var rnMineBuffer = crypto.randomBytes(identityExchangeUtils.rnBufferLength);
  largerHashStateMachine.start();
  largerHashStateMachine.exchangeIdentity(smallHash);
  makeGoodCb(rnMineBuffer)
    .then(function(res) {
      return request(thaliApp)
        .post(identityExchangeUtils.rnMinePath)
        .send(createRnMine(urlSafeBase64.encode(crypto.randomBytes(identityExchangeUtils.rnBufferLength)),
          smallHashBase64))
        .expect(400)
        .expect(valFourHundred(t, identityExchangeUtils.fourHundredErrorCodes.malformed, bigHashBase64));
    }).then(function(res) {
      t.end();
    }).catch(function(err) {
      t.fail(err);
    });
});

test("Make sure apis don't allow incorrect states", function(t) {
  // With BigHash
  t.throws(function() { largerHashStateMachine.stop(); });
  t.throws(function() { largerHashStateMachine.exchangeIdentity(smallHash); });
  t.throws(function() { largerHashStateMachine.exchangeIdentity(bigHash); });
  largerHashStateMachine.start(); // Making sure flipping start-stop-start doesn't break anything
  largerHashStateMachine.stop();
  largerHashStateMachine.exchangeIdentity(bigHash); // We already in NoIdentityExchange
  t.throws(function() { largerHashStateMachine.exchangeIdentity(smallHash); });
  t.throws(function() { largerHashStateMachine.start(); });
  t.throws(function() { largerHashStateMachine.exchangeIdentity(smallHash); });
  t.throws(function() { largerHashStateMachine.exchangeIdentity(bigHash); });
  largerHashStateMachine.stop();
  largerHashStateMachine.exchangeIdentity(smallHash); // In certain cases you can skip start
  t.throws(function() { largerHashStateMachine.start(); });

  var rnMineBuffer = crypto.randomBytes(identityExchangeUtils.rnBufferLength);
  var rnOther = null;
  largerHashStateMachine.once(LargerHashStateMachine.Events.ValidationCodeGenerated, function(code) {
    var rnOtherBuffer = identityExchangeUtils.validateRnAndGetBase64Object(rnOther);
    t.notEqual(rnOtherBuffer, null);
    t.equal(code,
      identityExchangeUtils.generateValidationCode(rnOtherBuffer, bigHash, smallHash, rnMineBuffer));
    t.end();
  });
  makeGoodCb(rnMineBuffer)
    .then(function(res) {
      rnOther = res.body.rnOther;
      return makeGoodRnMine(rnMineBuffer);
    }).catch(function(err) {
      t.fail(err);
    });
});

test("Make sure we can start, complete and then restart and complete, no state gets horked", function(t) {
  var rnMineBuffer = crypto.randomBytes(identityExchangeUtils.rnBufferLength);
  largerHashStateMachine.start();
  largerHashStateMachine.exchangeIdentity(smallHash);
  makeGoodCb(rnMineBuffer)
    .then(function(res) {
      return makeGoodRnMine(rnMineBuffer);
    }).then(function(res) {
      largerHashStateMachine.stop();
      largerHashStateMachine.start();
      largerHashStateMachine.exchangeIdentity(smallHash);
      return makeGoodCb(rnMineBuffer);
    }).then(function(res) {
      return makeGoodRnMine(rnMineBuffer);
    }).then(function(res) {
      t.end();
    }).catch(function(err) {
      t.fail(err);
    });
});
