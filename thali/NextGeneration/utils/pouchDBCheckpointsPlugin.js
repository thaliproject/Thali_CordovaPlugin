'use strict';

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
  var events = null;
  var handlers = [];

  // Private methods
  function setupSizePlugin () {
    if (!db.installSizeWrapper) {
      throw new Error('This plugin depends on pouchdb-size plugin. Please add pouchdb-size plugin befor this one.');
    }

    db.installSizeWrapper();
  }

  function setupDBEvents () {
    events = db.changes({
      live: true,
      since: 'now'
    });

    events.on('error', function (error) {
      logger.error('Error while fetching db changes: \'%s\', stack: \'%s\'', String(error), error.stack);
      events.cancel();
    });
    events.on('change', executeOnce(checkDBSize.bind(this), delay));

    db.on('destroyed', function () {
      events.cancel();
    });
  }

  function checkDBSize () {
    return db.info()
      .then(function (response) {
        if (!response) return;

        var dbSize = response.disk_size;
        // Handlers should be called only once
        // after the first reaching of a checkpoint
        if (dbSize >= checkpoint) {
          handlers
            .forEach(function (handler) {
              // It might be better for performance
              // to execute handlers asynchronously
              executeAsync(handler)(checkpoint);
            });
        }
      })
      .catch(function (error) {
        logger.error('Error while fetching db info: \'%s\', stack: \'%s\'', String(error), error.stack);
        db.emit('error', error);
      });
  }

  // Public constructor
  function CheckpointPlugin () {
    setupSizePlugin();
    setupDBEvents();
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
    var args = arguments;
    if (!timeout) {
      timeout = setTimeout(function () {
        fn.apply(null, args);
        clearTimeout(timeout);
        timeout = null;
      }, delay);
    }
  }
}

var executeAsync = function (fn) {
  return function () {
    var args = arguments;
    setTimeout(function () {
      fn.apply(null, args);
    });
  }
}
