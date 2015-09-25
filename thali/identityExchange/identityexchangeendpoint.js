/* jshint node: true, undef: true, unused: true  */
/* globals Promise */
'use strict';

var bodyParser = require('body-parser');
var Promise = require('lie');

module.exports = function (app, serverPort, dbName, replicationManager, IdentityExchange) {
  var identityExchange = new IdentityExchange(app, serverPort, replicationManager, dbName);

  // state
  var peerFriendlyName,
      peerStarted,
      peerIdentifier,
      peers = {},
      currentPeer,
      deviceIdentity,
      verificationCode,
      exchangeStatus;

  replicationManager.getDeviceIdentity(function (err, id) {
    deviceIdentity = id;
  });

  replicationManager.on('peerIdentityExchange', function (peer) {
    peers[peer.peerIdentifier] = peer;
  });

  function clearState() {
    error = null;
    verificationCode = null;
    peerIdentifier = null;
    currentPeer = null;
    peerStarted = false;
    exchangeStatus = null;
  }

  // Global queueing
  var globalPromise = Promise.resolve(true);

  function enqueue(fn) {
    globalPromise = globalPromise.then(function () {
      return new Promise(function (resolve, reject) {
        fn(resolve, reject);
      });
    });
  }

  app.get(
    '/webview/deviceidentity',
    function (req, res) {

      replicationManager.getDeviceIdentity(function (err, id) {
        if (err) {
          return res.status(500).json({
            errorCode: 'E_DEVICEIDNOTSET',
            errorDescription: 'Device Identity not set'
          });
        }
        res.status(200).json({
          'deviceIdentity': id
        });
      });
  });

  app.put(
    '/webview/identityexchange',
    bodyParser.json(),
    function (req, res) {

      enqueue(function (resolve) {
        // Validate Body
        if (typeof req.body.peerFriendlyName !== 'string') {
          res.status(400).json({
            errorCode: 'E_PEERFRIENDLYNAMEMISSING',
            errorDescription: 'Request body missing peerFriendlyName property'
          });
          return resolve();
        }

        // If we've already started, just return 201 and don't bother doing it again
        if (peerFriendlyName == req.body.peerFriendlyName && peerStarted) {
          res.sendStatus(201);
          return resolve();
        }

        // If we haven't seen a DELETE yet and a different name comes
        if (peerFriendlyName !== req.body.peerFriendlyName && peerStarted) {
          res.status(400).json({
            errorCode: 'E_INVALIDEXCHANGE',
            errorDescription: 'Can only do one exchange at a time'
          });
          return resolve();
        }

        peerFriendlyName = req.body.peerFriendlyName;
        identityExchange.startIdentityExchange(peerFriendlyName, function (err) {
          if (err) {
            resolve();
            return res.status(500).json({
              errorCode: 'E_STARTIDEXCHANGEFAILED',
              errorDescription: 'Start Identity Exchange Failed'
            });
          }

          peerStarted = true;
          res.sendStatus(201);
          resolve();
        });
      });
  });

  app.delete(
    '/webview/identityexchange',
    function (req, res) {

      enqueue(function (resolve) {
        if (!peerStarted) {
          res.status(404).json({
            errorCode: 'E_NOCURRENTIDEXCHANGE',
            errorDescription: 'No Current Identity Exchange Pending'
          });
          return resolve();
        }

        identityExchange.stopIdentityExchange(function (err) {
          if (err) {
            res.status(500).json({
              errorCode: 'E_STOPIDEXCHANGEFAILED',
              errorDescription: 'Stop Identity Exchange Failed'
            });
            return resolve();
          }

          clearState();
          res.sendStatus(204);
          resolve();
        });
      });
  });

  app.get(
    '/webview/identityexchange',
    function (req, res) {

      if (!peerStarted) {
        res.status(404).json({
          errorCode: 'E_NOCURRENTIDEXCHANGE',
          errorDescription: 'No Current Identity Exchange Pending'
        });
        return;
      }

      res.status(200).json({
        peerFriendlyName: peerFriendlyName,
        peers: Object.keys(peers).map(function (peerId) {
          var p = peers[peerId];
          return {
            peerPublicKeyHash: p.peerName,
            peerDeviceId: p.peerIdentifier,
            peerFriendlyName: p.peerFriendlyName
          };
        })
      });
  });

  var error;

  app.put(
    '/webview/identityexchange/executeexchange',
    bodyParser.json(),
    function (req, res) {

      enqueue(function (resolve) {

        if (!peerStarted) {
          res.status(404).json({
            errorCode: 'E_NOCURRENTIDEXCHANGE',
            errorDescription: 'No Current Identity Exchange Pending'
          });
          return resolve();
        }

        // Validate Body
        if (typeof req.body.peerDeviceId !== 'string') {
          res.status(400).json({
            errorCode: 'E_PEERDEVICEIDMISSING',
            errorDescription: 'Request body missing peerDeviceId property'
          });
          return resolve();
        }

        // Check if we already have one in progress
        if (peerIdentifier && req.body.peerDeviceId !== peerIdentifier) {
          res.status(400).json({
            errorCode: 'E_INVALIDEXCHANGE',
            errorDescription: 'Only one peer exchance can happen at once'
          });
          return resolve();
        }

        // Check if we have it in our list of peers
        var p = peers[req.body.peerDeviceId];
        if (!p) {
          res.status(400).json({
            errorCode: 'E_PEERDEVICEIDNOTFOUND',
            errorDescription: 'peerDeviceId does not match any known peers'
          });
          return resolve();
        }

        currentPeer = p;
        exchangeStatus = 'pending';

        res.sendStatus(202);

        // Start regularly
        peerIdentifier = req.body.peerDeviceId;
        identityExchange.executeIdentityExchange(peerIdentifier, p.peerName, function (err, code) {
          exchangeStatus = 'error';
          if (err) {
            error = {
              status: exchangeStatus,
              statusCode: 500,
              errorCode: 'E_STARTEXECUTEIDEXCHANGEFAILED',
              errorDescription: 'Start Executing Identity Exchange Failed'
            };
            return resolve();
          }

          exchangeStatus = 'complete';
          verificationCode = code;
          resolve();
        });
      });
  });

  app.delete(
    '/webview/identityexchange/executeexchange',
    bodyParser.json(),
    function (req, res) {

      enqueue(function (resolve) {
        if (!peerIdentifier) {

          res.status(404).json({
            errorCode: 'E_NOCURRENTIDEXCHANGE',
            errorDescription: 'No Current Identity Exchange Pending'
          });
          return resolve();
        }

        identityExchange.stopExecutingIdentityExchange();

        clearState();
        res.sendStatus(204);
        resolve();
      });
  });

  app.get(
    '/webview/identityexchange/executeexchange',
    function (req, res) {

      // Check for peer identifier
      if (!peerIdentifier) {
        res.status(404).json({
          status: 'error',
          errorCode: 'E_NOCURRENTIDEXCHANGE',
          errorDescription: 'No Current Identity Exchange Pending'
        });
        return;
      }

      // Check for error
      if (error) {
        res.status(error.statusCode).json({
          peerDeviceId: currentPeer.peerIdentifier,
          status: exchangeStatus,
          errorCode: error.errorCode,
          errorDescription: error.errorDescription
        });
        return;
      }

      if (exchangeStatus === 'pending') {
        res.status(200).json({
          status: exchangeStatus,
          peerDeviceId: currentPeer.peerIdentifier,
        });
      }

      // Check for code
      if (verificationCode) {
        res.status(200).json({
          verificationCode: verificationCode,
          status: exchangeStatus,
          peerDeviceId: currentPeer.peerIdentifier,
          publicKeyHash: currentPeer.peerName
        });
        return;
      }

  });
};
