'use strict';

var inherits = require('util').inherits;
var net = require('net');
var assert = require('assert');
var Promise = require('lie');
var EventEmitter = require('events').EventEmitter;
var extend = require('js-extend').extend;

var logger = require('../../../lib/testLogger')('ClientRound');

var ActiveConnections = require('./ActiveConnections');
var Message = require('./Message');

var tape = require('../../../lib/thaliTape');


function ClientRound(tapeTest, roundNumber, quitSignal, options) {
  this.roundNumber = roundNumber;

  this._tapeTest   = tapeTest;
  this._quitSignal = quitSignal;

  this._state = ClientRound.states.CREATED;
  this._validPeerIds = {};

  this.options = extend({}, ClientRound.defaults, options);

  this._activeConnections = new ActiveConnections(this._quitSignal, {
    timeout: this.options.connectTimeout
  });

  this.bind();
}

inherits(ClientRound, EventEmitter);

ClientRound.defaults = {
  connectRetries: 10,
  connectRetryTimeout: 3500,
  connectTimeout: 3000,
}

ClientRound.states = {
  CREATED:  'created',
  STOPPING: 'stopping',
  STOPPED:  'stopped'
}

ClientRound.prototype.setRoundNumber = function (roundNumber) {
  assert(
    this._state === ClientRound.states.STOPPED,
    'we should be in stopped state'
  );
  this._state = ClientRound.states.CREATED;

  this._validPeerIds = {};
  this.roundNumber = roundNumber;
  this._activeConnections.reset();
}

ClientRound.prototype.bind = function () {
  this._peerAvailabilityChangedHandler = this._peerAvailabilityChanged.bind(this);
  Mobile('peerAvailabilityChanged').registerToNative(this._peerAvailabilityChangedHandler);
}

ClientRound.prototype.unbind = function () {
  if (this._peerAvailabilityChangedHandler) {
    Mobile('peerAvailabilityChanged').registerToNative(function () {});
    delete this._peerAvailabilityChangedHandler;
  }
}

ClientRound.prototype._peerAvailabilityChanged = function (peers) {
  var self = this;
  // 'self._validPeerIds[peerId]' will be 'undefined' if this peer
  // didn't try to connect to us or it failed with validation.
  // It will be 'false' if this peer is doing it's validation.
  // It will be 'true' if this peer succeed with validation.

  var promises = peers.map(function (peer) {
    if (self._validPeerIds[peer.peerIdentifier] !== undefined) {
      // This peer is doing it's validation or it succeed with validation.
      return;
    }

    if (!peer.peerAvailable) {
      // In theory a peer could become unavailable and then with the same
      // peerID available again so we have to be willing to accept future
      // connections from this peer.
      logger.warn(
        'we got an unavailable peer, peerIdentifier: %s',
        peer.peerIdentifier
      );
      return;
    }

    // This peer is doing it's validation now.
    // This will block other connection attempts to this peer for now.
    self._validPeerIds[peer.peerIdentifier] = false;

    logger.debug(
      'connecting to peer, peerIdentifier: %s',
      peer.peerIdentifier
    );

    return self._connectToPeer(peer)
    .then(function (connectionData) {
      logger.debug(
        'peer is connected, peerIdentifier: %s, connection: %s',
        peer.peerIdentifier, JSON.stringify(connectionData)
      );
      return self._processTestMessage(connectionData);
    })
    .then(function () {
      // Peer succeed with it's validation.
      self._validPeerIds[peer.peerIdentifier] = true;
    })
    .catch(function (error) {
      logger.error(error.toString());
      // We couldn't connect to the peer or it failed with validation.
      // We are waiting until this peer will be available again.
      delete self._validPeerIds[peer.peerIdentifier];
    });
  });

  Promise.all(promises)
  .then(function () {
    // We can check whether all peers are valid.
    var validPeersCount = 0;
    for (var peerId in self._validPeerIds) {
      if (self._validPeerIds[peerId]) {
        validPeersCount ++;
      }
    };
    if (validPeersCount === self._tapeTest.participants.length - 1) {
      logger.debug('finished');
      self.emit('finished');
    }
  })
  .catch(function (error) {
    logger.error(error.toString());
  });
}

ClientRound.prototype._connectToPeer = function (peer) {
  var self = this;

  return new Promise(function (resolve, reject) {
    function handler (retries) {
      retries --;
      if (retries < 0) {
        reject(new Error(
          'connect retries exceed'
        ));
        return;
      }
      if (self._quitSignal.raised) {
        reject(new Error(
          'connect retries was stopped by quit signal'
        ));
        return;
      }

      var data = ClientRound._connectToPeer(peer);
      self._activeConnections.add(data);

      data.promise
      .then(function (connectionData) {
        resolve(connectionData);
      })
      .catch(function (error) {
        logger.error(error.toString());
        setTimeout(function () {
          handler(retries);
        }, self.options.connectRetryTimeout);
      });
    }
    handler(self.options.connectRetries);
  });
}

ClientRound._connectToPeer = function (peer) {
  var data = {};
  data.promise = new Promise(function (resolve, reject) {
    data.resolve = resolve;
    data.reject  = reject;

    Mobile('connect').callNative(
      peer.peerIdentifier,
      function (error, connectionData) {
        if (error) {
          reject(error);
          return;
        }
        connectionData = JSON.parse(connectionData);
        assert(connectionData.listeningPort !== 0, 'Testing for old code');
        resolve(connectionData);
      }
    );
  });
  return data;
}

ClientRound.prototype._processTestMessage = function (connectionData) {
  var self = this;

  if (this._quitSignal.raised) {
    return Promise.reject(new Error(
      'processing of text message was aborted by quit signal'
    ));
  }

  var requestMessage = new Message(tape.uuid, this.roundNumber);

  var data = {};
  data.promise = new Promise(function (resolve, reject) {
    data.resolve = resolve;
    data.reject  = reject;

    var connection = net.connect(connectionData.listeningPort, function () {
      logger.debug(
        'sending message to peer, our uuid: %s',
        tape.uuid
      );
      requestMessage.writeTo(connection)

      .then(function () {
        logger.debug('reading peer response');
        return Message.read(connection);
      })
      .then(function (responseMessage) {
        logger.debug(
          'received peer response with code: %s',
          responseMessage.code
        );
        self._validateMessage(responseMessage);
        resolve();
      })
      .catch(function (error) {
        reject(error);
      })
    });
    data.connection = connection;
  });

  data.promise
  .catch(function (error) {
    logger.error(error.toString());
  });

  this._activeConnections.add(data);

  return data.promise;
}

ClientRound.prototype._validateMessage = function (message) {
  // Array.prototype.any is not defined in current jxcore.
  // TODO add polyfill and replace this with 'any'.
  var validParticipant = this._tapeTest.participants
  .filter(function (participant) {
    return participant.uuid === message.uuid;
  })
  .length === 1;
  if (!validParticipant) {
    throw new Error('this server is not a valid participant');
  }

  if (message.bulkData.toString() !== Message.bulkData.toString()) {
    throw new Error('this server received invalid \'bulkData\'');
  }

  if (message.uuid === tape.uuid) {
    throw new Error('this server is me');
  }

  if (message.code !== Message.codes.SUCCESS) {
    throw new Error('Server error code: ' + message.code);
  }
}

ClientRound.prototype.stop = function () {
  var self = this;

  switch (this._state) {
    case ClientRound.states.STOPPING: {
      assert(
        this._stopPromise,
        '\'_stopPromise\' should exist'
      );
      return this._stopPromise;
    }
    case ClientRound.states.STOPPED: {
      return Promise.resolve();
    }
  }
  assert(
    this._state === ClientRound.states.CREATED,
    'we should be in created state'
  );
  this._state = ClientRound.states.STOPPING;

  this._stopPromise = this._activeConnections.stop()
  .then(function () {
    self.unbind();
    self._state = ClientRound.states.STOPPED;
    delete self._stopPromise;

    if (self._waitUntilStoppedPromise) {
      self._waitUntilStoppedResolve();
      delete self._waitUntilStoppedPromise;
      delete self._waitUntilStoppedResolve;
    }

    logger.debug('client has stopped');
  });

  return this._stopPromise;
}

ClientRound.prototype.waitUntilStopped = function () {
  var self = this;

  switch (this._state) {
    case ClientRound.states.STOPPING: {
      assert(
        this._stopPromise,
        '\'_stopPromise\' should exist'
      );
      return this._stopPromise;
    }
    case ClientRound.states.STOPPED: {
      return Promise.resolve();
    }
  }
  assert(
    this._state === ClientRound.states.CREATED,
    'we should be in created state'
  );

  if (this._waitUntilStoppedPromise) {
    return this._waitUntilStoppedPromise;
  }
  return this._waitUntilStoppedPromise = new Promise(function (resolve) {
    self._waitUntilStoppedResolve = resolve;
  });
}

module.exports = ClientRound;
