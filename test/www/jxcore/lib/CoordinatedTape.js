'use strict';

var util     = require('util');
var inherits = util.inherits;

var objectAssign = require('object-assign');
var assert       = require('assert');
var uuid         = require('node-uuid');

var Promise = require('bluebird');

var SimpleThaliTape   = require('./SimpleTape');
var CoordinatedClient = require('./CoordinatedClient');

var logger = require('thali/ThaliLogger')('CoordinatedThaliTape');


function CoordinatedThaliTape (options) {
  // We are calling this function directly without 'new'.
  if (!this) {
    return new CoordinatedThaliTape(options);
  }

  return CoordinatedThaliTape.super_.call(this, options);
}

inherits(CoordinatedThaliTape, SimpleThaliTape);

CoordinatedThaliTape.states    = SimpleThaliTape.states;
CoordinatedThaliTape.instances = SimpleThaliTape.instances;
CoordinatedThaliTape.begin     = SimpleThaliTape.begin;

// 'tape.uuid' here.
CoordinatedThaliTape.uuid = uuid.v4();

CoordinatedThaliTape.prototype.defaults = objectAssign(
  {},
  CoordinatedThaliTape.prototype.defaults,
  {
    emitRetryCount:   20,
    emitRetryTimeout: 1000
  }
);

CoordinatedThaliTape.prototype._begin = function () {
  assert(
    this._state === CoordinatedThaliTape.states.created,
    'we should be in created state'
  );
  this._state = CoordinatedThaliTape.states.started;
}

CoordinatedThaliTape.prototype._getTests = function () {
  var self = this;
  return this._tests.map(function (test) {
    // We don't need to copy '_options', it will be used readonly.
    test.options = self._options;
    return test;
  });
}

CoordinatedThaliTape.begin = function (platform, version, hasRequiredHardware) {
  var tests = CoordinatedThaliTape.instances.reduce(function (tests, thaliTape) {
    thaliTape._begin();
    return tests.concat(thaliTape._getTests());
  }, []);
  CoordinatedThaliTape.instances = [];

  var _testClient = new CoordinatedClient(
    tests,
    CoordinatedThaliTape.uuid,
    platform,
    version,
    hasRequiredHardware
  );

  // Only used for testing purposes.
  CoordinatedThaliTape._testServer = _testClient._io;

  return new Promise(function (resolve, reject) {
    _testClient.once('finished', function (error) {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  })
  .then(function () {
    logger.debug('all tests succeed');
    logger.debug('****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****');
  })
  .catch(function (error) {
    logger.error(
      'tests failed, error: \'%s\', stack: \'%s\'',
      error.toString(), error.stack
    );
    logger.debug('****TEST_LOGGER:[PROCESS_ON_EXIT_FAILED]****');
    return Promise.reject(error);
  });
}

module.exports = CoordinatedThaliTape;
