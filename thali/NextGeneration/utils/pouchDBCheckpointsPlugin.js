'use strict';

var Promise = require('lie');
var logger = require('../../ThaliLogger')('pouchDBCheckpointsPlugin');

module.exports.onCheckpointReached = function (handler) {
  var db = this;
  var plugin = db.__checkpointPlugin;

  if (!plugin) {
    plugin = db.__checkpointPlugin = new CheckpointPlugin(db);
  }

  plugin.registerHandler(handler);
};

var DEFAULT_DELAY = 200;

var CheckpointPlugin = function (_db) {
  // Private data
  var db = _db;
  var checkpoint = db.__opts.checkpoint;
  var delay = db.__opts.checkpointDelay || DEFAULT_DELAY;
  var handlers = [];
  var destroyed = false;

  // Private methods
  function checkDBSize () {
    if (destroyed) {
      logger.warn('Couldn\'t check db size after destroy');
      return Promise.resolve();
    }

    return db.info()
      .then(function (response) {
        if (!response) return;

        // We want to call 'getDiskSize' directly without ignoring errors.
        // https://github.com/pouchdb/pouchdb-size/issues/22
        return db.getDiskSize()
          .then(function (diskSize) {
            // Handlers should be called only once
            // after the first reaching of a checkpoint
            if (diskSize >= checkpoint) {
              handlers
                .forEach(function (handler) {
                  // It might be better for performance
                  // to execute handlers asynchronously
                  executeAsync(handler)(checkpoint);
                });
            }
          });
      })
      .catch(function (error) {
        logger.error(
          'Error while fetching db info: \'%s\', stack: \'%s\'',
          String(error), error.stack
        );
        db.emit('error', error);
      });
  }

  // Public constructor
  function CheckpointPlugin () {
    if (!db.getDiskSize) {
      throw new Error(
        'This plugin depends on pouchdb-size plugin. ' +
        'Please add pouchdb-size plugin befor this one.'
      );
    }

    var changes = db.changes({
      live: true,
      since: 'now'
    })
      .on('error', function (error) {
        logger.error(
          'Error while fetching db changes: \'%s\', stack: \'%s\'',
          String(error), error.stack
        );
        changes.cancel();
        db.emit('error', error);
      })
      .on('change', executeOnce(checkDBSize, delay));

    db.on('destroyed', function () {
      destroyed = true;
      changes.cancel();
    });
  }

  // Public methods
  CheckpointPlugin.prototype.registerHandler = function (handler) {
    handlers.push(handler);
  };

  return new CheckpointPlugin();
};

var executeOnce = function (fn, delay) {
  var timeout = null;
  return function () {
    var self = this;
    var args = arguments;
    if (!timeout) {
      timeout = setTimeout(function () {
        fn.apply(self, args);
        clearTimeout(timeout);
        timeout = null;
      }, delay);
    }
  }
}

var executeAsync = function (fn) {
  return function () {
    var self = this;
    var args = arguments;
    process.nextTick(function () {
      fn.apply(self, args);
    });
  }
}
