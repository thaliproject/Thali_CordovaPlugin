'use strict';

var net = require('net');
var inherits = require('util').inherits;
var assert = require('assert');
var Promise = require('lie');
var EventEmitter = require('events').EventEmitter;
var extend = require('js-extend').extend;

var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');

var ActiveConnections = require('./ActiveConnections');
var Message = require('./Message');

var tape = require('../../../lib/thaliTape');

var logger = require('../../../lib/testLogger')('ServerRound');


function ServerRound(tapeTest, roundNumber, quitSignal, options) {
  this.roundNumber = roundNumber;

  this._tapeTest   = tapeTest;
  this._quitSignal = quitSignal;

  this._startPromise = null;
  this._validPeerIds = {};
  this._server = net.createServer();

  this._state = ServerRound.states.CREATED;

  this.options = extend({}, ServerRound.defaults, options);

  this._activeConnections = new ActiveConnections(this._quitSignal, {
    timeout: this.options.connectTimeout
  });

  this.bind();
}

inherits(ServerRound, EventEmitter);

ServerRound.defaults = {
  connectTimeout: 3000
}

ServerRound.states = {
  CREATED:  'created',
  STARTING: 'starting',
  STARTED:  'started',
  STOPPING: 'stopping',
  STOPPED:  'stopped'
}

ServerRound.prototype.setRoundNumber = function (roundNumber) {
  assert(
    this._state === ServerRound.states.STOPPED ||
    this._state === ServerRound.states.STARTED,
    'we should be in stopped state'
  );
  if (this._state === ServerRound.states.STOPPED) {
    this._activeConnections.reset();
  }
  this._state = ServerRound.states.CREATED;

  this._validPeerIds = {};
  this.roundNumber = roundNumber;
}

ServerRound.prototype.bind = function () {
  this._newConnectionHandler = this._newConnection.bind(this);
  this._server.on('connection', this._newConnectionHandler);

  this._server.on('error', function (err) {
    logger.error('received server error' + err);
  });
  this._server = makeIntoCloseAllServer(this._server);
}

ServerRound.prototype.unbind = function () {
  if (this._newConnectionHandler) {
    this._server.removeListener('connection', this._newConnectionHandler);
    delete this._newConnectionHandler;
  }
}

ServerRound.prototype.start = function () {
  var self = this;

  switch (this._state) {
    case ServerRound.states.STARTING: {
      assert(this._startPromise, 'start promise should exist');
      return this._startPromise;
    }
    case ServerRound.states.STARTED: {
      return Promise.resolve();
    }
  }
  assert(
    this._state === ServerRound.states.CREATED,
    'we should be in created or stopped state'
  );
  this._state = ServerRound.states.STARTING;

  this._startPromise = new Promise(function (resolve, reject) {
    self._startResolve = resolve;
    self._startReject  = reject;

    if (self.roundNumber === 0) {
      // Listen on any random port.
      self._server.listen(0, function () {
        var address = self._server.address();
        assert(address, 'address should exist');
        assert(address.port, 'address port should exist');

        Mobile('startUpdateAdvertisingAndListening').callNative(
          address.port,
          function (error) {
            if (error) {
              reject(error);
              return;
            }
            Mobile('startListeningForAdvertisements').callNative(
              function (error) {
                if (error) {
                  reject(error);
                } else {
                  resolve();
                }
              }
            );
          }
        );
      });
    } else {
      var address = self._server.address();
      assert(address, 'address should exist');
      assert(address.port, 'address port should exist');

      Mobile('startUpdateAdvertisingAndListening').callNative(
        address.port,
        function (error) {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        }
      );
    }
  });

  this._startPromise
  .catch(function (error) {
    logger.error(error.toString());
  });

  return this._startPromise
  .then(function () {
    assert(
      self._state === ServerRound.states.STARTING,
      'we should be in starting state'
    );
    self._state = ServerRound.states.STARTED;

    delete self._startPromise;
    delete self._startResolve;
    delete self._startReject;

    logger.debug('round %s started', self.roundNumber);
  });
}

ServerRound.prototype._newConnection = function (connection) {
  var self = this;

  if (this._quitSignal.raised) {
    logger.warn(
      'processing of new connection was aborted by quit signal'
    );
    return;
  }

  var data = {};
  data.promise = new Promise(function (resolve, reject) {
    data.resolve = resolve;
    data.reject = reject;

    var requestPeerId;
    var responseMessage;

    logger.debug('new connection');

    Message.read(connection)
    .then(function (requestMessage) {
      requestPeerId = requestMessage.uuid;
      logger.debug(
        'received message from uuid: %s',
        requestMessage.uuid
      );

      var responseCode = self._validateMessage(requestMessage);
      responseMessage = new Message(tape.uuid, responseCode);

      logger.debug(
        'sending response code: %s to uuid: %s',
        responseCode, requestMessage.uuid
      );
      return responseMessage.writeTo(connection);
    })

    .then(function () {
      logger.debug(
        'Message written, connection.end'
      );
      connection.end();
      return new Promise(function (resolve, reject) {
        connection
        .once('end', resolve)
        .once('error', reject);
      });
    })

    .then(function () {
      switch (responseMessage.code) {
        case Message.codes.WRONG_SYNTAX: // Usually connection died
        case Message.codes.WRONG_TEST:
        case Message.codes.WRONG_ME:
        case Message.codes.WRONG_GEN: {
          resolve();
          break;
        }
        case Message.codes.SUCCESS: {
          // We can receive here multiple valid peers.
          // We can just ignore this case.
          self._validPeerIds[requestPeerId] = true;
          resolve();
          break;
        }
        default: {
          reject(new Error(
            'validationResult code ' + responseCode
          ));
          break;
        }
      }
    })
    .catch(function (error) {
      reject(error);
    });
  });
  data.connection = connection;

  this._activeConnections.add(data);

  data.promise
  .then(function () {
    // We can check whether all peers are valid.
    var validPeersCount = 0;
    for (var peerId in self._validPeerIds) {
      if (self._validPeerIds[peerId]) {
        validPeersCount ++;
      }
    };
    if (validPeersCount === self._tapeTest.participants.length - 1) {
      logger.debug('unreliable server finished without confirmation');
      self.emit('finished');
    }
  })
  .catch(function (error) {
    logger.error(error.toString());
  });
}

ServerRound.prototype._validateMessage = function (message) {
  // Array.prototype.any is not defined in current jxcore.
  // TODO add polyfill and replace this with 'any'.
  var validParticipant = this._tapeTest.participants
  .filter(function (participant) {
    return participant.uuid === message.uuid;
  })
  .length === 1;
  if (!validParticipant) {
    logger.error('this client is not a valid participant');
    return Message.codes.WRONG_TEST;
  }

  if (message.bulkData.toString() !== Message.bulkData.toString()) {
    logger.error('this client received invalid \'bulkData\'');
    return Message.codes.WRONG_SYNTAX;
  }

  if (message.uuid === tape.uuid) {
    logger.error('this client is me');
    return Message.codes.WRONG_ME;
  }

  if (message.code > this.roundNumber) {
    logger.error('this client is from bad round');
    return Message.codes.WRONG_GEN;
  }

  return Message.codes.SUCCESS;
}

ServerRound.prototype.stop = function () {
  var self = this;

  switch (this._state) {
    case ServerRound.states.STOPPING: {
      assert(
        this._stopPromise,
        '\'_stopPromise\' should exist'
      );
      return this._stopPromise;
    }
    case ServerRound.states.STOPPED: {
      return Promise.resolve();
    }
  }
  assert(
    this._state === ServerRound.states.STARTED,
    'we should be in started state'
  );
  this._state = ServerRound.states.STOPPING;

  this._stopPromise = this._activeConnections.stop()

  .then(function () {
    return new Promise(function (resolve, reject) {
      self._server.closeAll(function () {
        Mobile('stopListeningForAdvertisements').callNative(function (error) {
          if (error) {
            reject(new Error(error));
            return;
          }
          Mobile('stopAdvertisingAndListening').callNative(function (error) {
            if (error) {
              reject(new Error(error));
            } else {
              resolve();
            }
          });
        });
      });
    });
  })

  .then(function () {
    self.unbind();
    self._state = ServerRound.states.STOPPED;
    delete self._stopPromise;

    if (self._waitUntilStoppedPromise) {
      self._waitUntilStoppedResolve();
      delete self._waitUntilStoppedPromise;
      delete self._waitUntilStoppedResolve;
    }

    logger.debug('server has stopped');
  });

  return this._stopPromise;
}

ServerRound.prototype.waitUntilStopped = function () {
  var self = this;

  switch (this._state) {
    case ServerRound.states.STOPPING: {
      assert(
        this._stopPromise,
        '\'_stopPromise\' should exist'
      );
      return this._stopPromise;
    }
    case ServerRound.states.STOPPED: {
      return Promise.resolve();
    }
  }
  assert(
    this._state === ServerRound.states.CREATED ||
    this._state === ServerRound.states.STARTED,
    'we should be in created or started state'
  );

  if (this._waitUntilStoppedPromise) {
    return this._waitUntilStoppedPromise;
  }
  return this._waitUntilStoppedPromise = new Promise(function (resolve) {
    self._waitUntilStoppedResolve = resolve;
  });
}

module.exports = ServerRound;
