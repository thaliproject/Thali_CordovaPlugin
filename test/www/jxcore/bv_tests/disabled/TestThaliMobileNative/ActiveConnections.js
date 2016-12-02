'use strict';

var assert = require('assert');
var Promise = require('lie');
var extend = require('js-extend').extend;

var logger = require('../../../lib/testLogger')('ActiveConnections');


// We are going to add a new connections to the list.
// We want to limit the lifetime of this connection.
// We want each connection to be autoremoved from the list when it will become
// completed.
// We want to be able to do an emergency shutdown for all connections.
// We want to verify that each connection made shutdown correctly.
// We are completed only when the list will become empty.
function ActiveConnections(quitSignal, options) {
  this._quitSignal = quitSignal;

  this._connections = [];
  this._killPromise = null;

  this._state = ActiveConnections.states.CREATED;

  this.options = extend({}, ActiveConnections.defaults, options);

  this.bind();
}

ActiveConnections.defaults = {
  timeout: 3000
};

ActiveConnections.states = {
  CREATED:  'created',
  STOPPING: 'stopping',
  STOPPED:  'stopped'
};

ActiveConnections.prototype.bind = function () {
  // We will not unbind this handler.
  this._quitSignal.bindHandler(this._kill.bind(this));
};

ActiveConnections.prototype.add = function (data) {
  var self = this;

  assert(
    this._state === ActiveConnections.states.CREATED,
    'we should be in created state'
  );

  assert(data, '\'data\' should exist');
  assert(data.promise, '\'data.promise\' should exist');
  assert(data.resolve, '\'data.resolve\' should exist');
  assert(data.reject, '\'data.reject\' should exist');

  this._connections.push(data);
  this._bind_timeout(data);
  this._bind_autoremove(data);
  this._bind_connection(data);
};

ActiveConnections.prototype._bind_autoremove = function (data) {
  var self = this;

  data.promise
  .then(function () {
    if (data.connection) {
      logger.debug('connection.end');
      data.connection.end();
    }
  })
  .catch(function (error) {
    logger.error(error.toString());

    if (data.connection) {
      logger.debug('connection.destroy');
      data.connection.destroy();
    }
  })
  .then(function () {
    self._unbind_timeout(data);

    // Removing this data from the list on any promise result.
    var index = self._connections.indexOf(data);
    assert(index !== -1, 'connection data should be in the list');
    self._connections.splice(index, 1);
  });
};

ActiveConnections.prototype._bind_timeout = function (data) {
  data._timeout = setTimeout(function () {
    data.reject(new Error('connection timeout'));
  }, this.options.timeout);
};

ActiveConnections.prototype._unbind_timeout = function (data) {
  assert(data._timeout, '\'data._timeout\' should exist');
  clearTimeout(data._timeout);
};

ActiveConnections.prototype._bind_connection = function (data) {
  if (!data.connection) {
    // data.connection is not required.
    return;
  }

  // We are going to check whether connection dies in expected way.
  var errorFired = false;
  var endFired = false;
  var closedFired = false;

  new Promise(function (resolve, reject) {
    // TODO jxcore bug. Promise couldn't catch errors in these events.
    data.connection
    .on('error', function (error) {
      try {
        assert(!errorFired, 'On error handle to a socket');
        errorFired = true;
      } catch (e) {
        reject(e);
      }
    })
    .on('end', function () {
      try {
        assert(!endFired, 'One end handle to a socket');
        assert(!errorFired, 'Should not get an end after error');
        endFired = true;
      } catch (e) {
        reject(e);
      }
    })
    .on('close', function () {
      try {
        assert(!closedFired, 'One close to a customer');
        closedFired = true;
      } catch (e) {
        reject(e);
      }
    });
  })
  .catch(function (error) {
    data.reject(error);
  });
};

ActiveConnections.prototype.reset = function () {
  assert(
    this._state === ActiveConnections.states.STOPPED,
    'we should be in stopped state'
  );
  this._state = ActiveConnections.states.CREATED;

  assert(
    this._connections.length === 0,
    'we should have empty list'
  );
};

ActiveConnections.prototype.stop = function () {
  var self = this;

  switch (this._state) {
    case ActiveConnections.states.STOPPING: {
      assert(
        this._stopPromise,
        '\'_stopPromise\' should exist'
      );
      return this._stopPromise;
    }
    case ActiveConnections.states.STOPPED: {
      return Promise.resolve();
    }
  }
  assert(
    this._state === ActiveConnections.states.CREATED,
    'we should be in created state'
  );
  this._state = ActiveConnections.states.STOPPING;

  this._connections.forEach(function (data) {
    data.resolve();
  });

  this._stopPromise = Promise.all(
    this._connections.map(function (data) {
      return data.promise;
    })
  );

  this._stopPromise
  .catch(function (error) {
    // We can ignore any error here.
    logger.debug(error.toString());
  })
  .then(function () {
    assert(
      self._connections.length === 0,
      'we should have empty list'
    );
    self._state = ActiveConnections.states.STOPPED;
    delete self._stopPromise;
  });

  return this._stopPromise;
};

ActiveConnections.prototype._kill = function () {
  var self = this;

  if (this._killPromise) {
    return this._killPromise;
  }

  this._connections.forEach(function (data) {
    data.reject(new Error('killing connection'));
  });

  this._killPromise = Promise.all(
    this._connections.map(function (data) {
      return data.promise;
    })
  );

  this._killPromise
  .catch(function (error) {
    // We can ignore any error here.
    logger.debug(error.toString());
  })
  .then(function () {
    assert(
      self._connections.length === 0,
      'we should have empty list'
    );
    delete self._killPromise;
  });

  return this._killPromise;
};

module.exports = ActiveConnections;
