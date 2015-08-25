/* jshint node: true */
'use strict';

var http = require('http');
var crypto = require('crypto');
var request = require('request');

global.isInIdentityExchange = false;

module.exports = function identityExchange (app, replicationManager) {

  // TODO: Add this to the Thali Replication Manager itself
  replicationManager.on('peerAvailabilityChanged', function (peers) {
    peers.forEach(function (peer) {
      if (peer.peerName.indexOf(';') !== -1) {
        var split = peer.peerName.split(';');
        peer.peerFriendlyName = split[1];
        peer.peerName = split[0];

        replicationManager.emit('peerIdentityExchange', peer);
      }
    });
  });

  var originalDevice,
      newDeviceName;

  function startIdentityExchange(friendlyName, cb) {
    if (global.isInIdentityExchange) {
      return cb(new Error('Already in identity exchange'));
    }
    global.isInIdentityExchange = true;
    replicationManager.once('stopped', function () {

      replicationManager.once('started', function () {
        cb(null, newDeviceName);
      });

      originalDevice = replicationManager._deviceName;
      newDeviceName = replicationManager._deviceName + ';' + friendlyName;

      replicationManager.once('startError', cb);
      replicationManager.start(
        replicationManager._port,
        replicationManager._dbName,
        replicationManager._deviceName + ';' + friendlyName);
    });

    replicationManager.once('stopError', cb);
    replicationManager.stop();
  }

  function stopIdentityExchange(cb) {
    global.isInIdentityExchange = false;

    // TODO: Clean up all pending exchanges

    replicationManager.once('stopped', function () {

      replicationManager.once('started', function () {
        cb(null, originalDevice);
      });

      replicationManager.once('startError', cb);
      replicationManager.start(
        replicationManager._port,
        replicationManager._dbName,
        originalDevice);
    });

    replicationManager.once('stopError', cb);
    replicationManager.stop();
  }

  var pkMineBuffer, pkOtherBuffer, rnMine, pkOtherHash, exchangeCb;

  function executeIdentityExchange(pkMine, pkOther, cb) {
    if (!global.isInIdentityExchange) {
      return cb(new Error('Identity Exchange not started'));
    }

    pkMineBuffer = new Buffer(pkMine);
    pkOtherBuffer = new Buffer(pkOther);

    pkOtherHash = pkOther;

    rnMine = crypto.randomBytes(32);

    // TODO: Check if already connected

    replicationManager._emitter.connect(pkMine, function (err, port) {
      if (err) { return cb(err); }

      var req = request.post({
        url: 'http://localhost:' + port + '/identity/exchange',
        body: {
          hash: originalDevice
        }
      });

      req.once('response', function (response) {
        var theirHash = response.body.hash;
        var myBuffer = new Buffer(originalDevice);
        var otherBuffer = new Buffer(pkOtherHash);
        var theirBuffer = new Buffer(theirHash);

        if (response.status !== 200 || otherBuffer.compare(theirBuffer) !== 0) {
          executeIdentityExchange(pkMine, pkOther, cb);
        }

        if (myBuffer.compare(theirBuffer) < 0) {
          // My hash is smaller

          var concatHash = Buffer.concat([pkMineBuffer, pkOtherBuffer]);
          var cbHash = crypto.createHmac('sha256', rnMine);
          var cbBuffer = cbHash.update(concatHash);
          var cbValue = cbBuffer.toString('base64');

          var rnOtherReq = request.post({
            url: 'http://localhost:' + port + '/identity/cb',
            body: {
              cbValue: cbValue,
              pkMine: pkMine
            }
          });

          rnOtherReq.once('response', function (response) {
            // TODO: Check for errors/attach vectors

            var rnOther = new Buffer(response.body.rnOther);

            var rnMineReq = request.post({
              url: 'http://localhost:' + port + '/identity/cb',
              body: {
                rnMine: rnMine.toString('base64'),
                pkMine: pkMine
              }
            });

            rnMineReq.once('response', function (response) {
              // TODO: Check for errors/attach vectors

              if (response.status === 200) {
                var newConcat = Buffer.concat([pkMineBuffer, pkOtherBuffer, rnMine]);
                var newCrypto = crypto.createHmac('sha256', rnOther);
                var newHash = newCrypto.update(newConcat);
                var newBuffer = newHash.digest();

                var value = parseInt(newBuffer.toString('hex'), 16) % Math.pow(10, 6);
                cb(null, value);
              }
            });
          });
        } else if (myBuffer.compare(theirBuffer) > 0) {
          // My hash is bigger and rest is done in cb express endpoint
          exchangeCb = cb;
        } else {
          cb(new Error('Hashes cannot be equal'));
        }
      });
    });
  }

  app.post('/identity/exchange', function (req, res) {
    var postedHash = req.body.hash;
    if (global.isInIdentityExchange && postedHash === pkOtherHash) {
      res.status(200).json({ hash: originalDevice });
    } else {
      res.status(400).end();
    }
  });

  var cbValue;

  app.post('/identity/cb', function (req, res) {
    if (!global.isInIdentityExchange) {
      return res.status(400).end();
    }

    // First request
    if (req.body.cbValue) {
      cbValue = new Buffer(req.body.cbValue);
      var buf = new Buffer(req.body.pkMine);
      if (!buf.equals(pkOtherBuffer)) {
        return res.status(400).end();
      }

      res.status(200).json({ rnOther: rnMine.toString('base64') });
    }

    // Second request
    if (req.body.rnMine) {
      var rnOther = new Buffer(req.body.rnMine);
      var newBuff = Buffer.concat([pkOtherBuffer, pkMineBuffer]);
      var hmac = crypto.createHmac('sha256', rnOther);
      hmac.update(newBuff);
      var ret = hmac.digest();

      // No match
      if (!ret.equals(cbValue)) {
        return res.status(400).end();
      }

      res.status(200).end();

      var finalBuff = Buffer.concat([pkMineBuffer, pkOtherBuffer, rnOther]);
      hmac = crypto.createHmac('sha256', rnMine);
      hmac.update(finalBuff);
      ret = hmac.digest();
      var value = parseInt(hmac.toString('hex'), 16) % Math.pow(10, 6);
      exchangeCb(null, value);
    }
  });

  return {
    startIdentityExchange: startIdentityExchange,
    executeIdentityExchange: executeIdentityExchange,
    stopIdentityExchange: stopIdentityExchange
  };
};
