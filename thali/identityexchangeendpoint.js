/* jshint node: true, undef: true, unused: true  */
/* globals Promise */
'use strict';

var bodyParser = require('body-parser');
require('lie/polyfill');

module.exports = function (app, replicationManager, identityExchangeModule) {
  var identityExchange = identityExchangeModule(app, replicationManager);

  // state
  var peerFriendlyName,
      peerStarted,
      peerIdentifier,
      peers = {},
      currentPeer,
      deviceIdentity,
      verificationCode;

    replicationManager.getDeviceIdentity(function (err, id) {
      deviceIdentity = id;
    });

  replicationManager.on('peerIdentityExchange', function (peer) {
    peers[peer.peerIdentifier] = peer;
  });

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
          return res.sendStatus(400).json({
            errorCode: 'E_DEVICEIDNOTSET',
            errorDescription: 'Device Identity not set'
          });
        }
        res.sendStatus(200).json({
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
        if (!req.body && typeof req.body.peerFriendlyName !== 'string') {
          res.sendStatus(400).json({
            errorCode: 'E_PEERFRIENDLYNAMEMISSING',
            errorDescription: 'Request body missing peerFriendlyName property'
          });
          resolve();
          return;
        }

        if (req.body.peerFriendlyName.length < 1 || req.body.peerFriendlyName > 20) {
          res.sendStatus(400).json({
            errorCode: 'E_PEERFRIENDLYNAMEINVALID',
            errorDescription: 'Request body peerFriendlyName property invalid length'
          });
          resolve();
          return;
        }

        // If we've already started, just return 201 and don't bother doing it again
        if (peerFriendlyName == req.body.peerFriendlyName && peerStarted) {
          res.sendStatus(201).end();
          resolve();
          return;
        }

        // If we haven't seen a DELETE yet and a different name comes in, redo
        if (peerFriendlyName !== req.body.peerFriendlyName && peerStarted) {
          identityExchange.stopidentityexchange(function (err) {
            if (err) {
              resolve();
              res.sendStatus(400).json({
                errorCode: 'E_STOPIDEXCHANGEFAILED',
                errorDescription: 'Stop Identity Exchange Failed'
              });
              return;
            }

            peerFriendlyName = req.body.peerFriendlyName;
            peerStarted = false;

            identityExchange.startidentityexchange(peerFriendlyName, function (err) {
              if (err) {
                res.sendStatus(400).json({
                  errorCode: 'E_STARTIDEXCHANGEFAILED',
                  errorDescription: 'Start Identity Exchange Failed'
                });
                resolve();
                return;
              }

              peerStarted = true;
              res.sendStatus(201).end();
              resolve();
              return;
            });
          });
        }

        peerFriendlyName = req.body.peerFriendlyName;
        identityExchange.startidentityexchange(peerFriendlyName, function (err) {
          if (err) {
            resolve();
            return res.sendStatus(400).json({
              errorCode: 'E_STARTIDEXCHANGEFAILED',
              errorDescription: 'Start Identity Exchange Failed'
            });
          }

          peerStarted = true;
          res.sendStatus(201).end();
          resolve();
        });
      });
  });

  app.delete(
    '/webview/identityexchange',
    function (req, res) {

      enqueue(function (resolve) {
        if (!peerStarted) {
          res.sendStatus(404).json({
            errorCode: 'E_NOCURRENTIDEXCHANGE',
            errorDescription: 'No Current Identity Exchange Pending'
          });
          resolve();
          return;
        }

        identityExchange.stopidentityexchange(function (err) {
          if (err) {
            res.sendStatus(400).json({
              errorCode: 'E_STOPIDEXCHANGEFAILED',
              errorDescription: 'Stop Identity Exchange Failed'
            });
            resolve();
            return;
          }

          peerStarted = false;
          peerFriendlyName = null;
          res.sendStatus(204);
          resolve();
        });
      });
  });

  app.get(
    '/webview/identityexchange',
    function (req, res) {

      if (!peerStarted) {
        res.sendStatus(404).json({
          errorCode: 'E_NOCURRENTIDEXCHANGE',
          errorDescription: 'No Current Identity Exchange Pending'
        });
        return;
      }

      res.sendStatus(200).json({
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
          res.sendStatus(404).json({
            errorCode: 'E_NOCURRENTIDEXCHANGE',
            errorDescription: 'No Current Identity Exchange Pending'
          });
          resolve();
          return;
        }

        // Validate Body
        if (!req.body && typeof req.body.peerDeviceId !== 'string') {
          res.sendStatus(400).json({
            errorCode: 'E_PEERDEVICEIDMISSING',
            errorDescription: 'Request body missing peerDeviceId property'
          });
          resolve();
          return;
        }

        // Check if we have it in our list of peers
        var p = peers[req.body.peerDeviceId];
        if (!p) {
          res.sendStatus(400).json({
            errorCode: 'E_PEERDEVICEIDNOTFOUND',
            errorDescription: 'peerDeviceId does not match any known peers'
          });
          resolve();
          return;
        }

        currentPeer = p;

        res.sendStatus(202).end();

        // Check if we already have one in progress
        if (req.body.peerDeviceId === peerIdentifier) {
          resolve();
          return;
        }

        // If different ID than currently in use
        if (peerIdentifier && req.body.peerDeviceId !== peerIdentifier) {
          // Stop service
          identityExchange.stopExecutingIdentityExchange(peerIdentifier, function (err) {
            if (err) {
              error = {
                statusCode: 400,
                errorCode: 'E_STOPEXECUTEIDEXCHANGEFAILED',
                errorDescription: 'Stop Executing Identity Exchange Failed'
              };
              resolve();
              return;
            }

            // Start with new one
            peerIdentifier = req.body.peerDeviceId;
            identityExchange.executeIdentityExchange(peerIdentifier, p.peerName, deviceIdentity, function (err, code) {
              if (err) {
                error = {
                  statusCode: 400,
                  errorCode: 'E_STARTEXECUTEIDEXCHANGEFAILED',
                  errorDescription: 'Start Executing Identity Exchange Failed'
                };
                resolve();
                return;
              }

              verificationCode = code;
              res.sendStatus(202).end();
              resolve();
            });
          });
        }

        // Start regularly
        peerIdentifier = req.body.peerDeviceId;
        identityExchange.executeIdentityExchange(peerIdentifier, p.peerName, deviceIdentity, function (err, code) {
          if (err) {
            error = {
              statusCode: 400,
              errorCode: 'E_STARTEXECUTEIDEXCHANGEFAILED',
              errorDescription: 'Start Executing Identity Exchange Failed'
            };
            resolve();
            return;
          }

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

          res.sendStatus(404).json({
            errorCode: 'E_NOCURRENTIDEXCHANGE',
            errorDescription: 'No Current Identity Exchange Pending'
          });
          resolve();
          return;
        }

        identityExchange.stopExecutingIdentityExchange(peerIdentifier, function (err) {
          if (err) {
            res.sendStatus(400).json({
              errorCode: 'E_STOPEXECUTEIDEXCHANGEFAILED',
              errorDescription: 'Stop Executing Identity Exchange Failed'
            });
            resolve();
            return;
          }

          verificationCode = null;
          peerIdentifier = null;
          currentPeer = null;
          res.sendStatus(204).end();
          resolve();
        });
      });
  });

  app.get(
    '/webview/identityexchange/executeexchange',
    function (req, res) {

      // Check for peer identifier
      if (!peerIdentifier) {
        res.sendStatus(404).json({
          errorCode: 'E_NOCURRENTIDEXCHANGE',
          errorDescription: 'No Current Identity Exchange Pending'
        });
        return;
      }

      // Check for error
      if (error) {
        res.sendStatus(error.statusCode).json({
          errorCode: error.errorCode,
          errorDescription: error.errorDescription
        });
        return;
      }

      // Check for code
      if (verificationCode) {
        res.sendStatus(200).json({
          verificationCode: verificationCode,
          status: 'complete',
          peerDeviceId: currentPeer.peerIdentifier,
          publicKeyHash: currentPeer.peerName
        });
        return;
      }

  });
};
