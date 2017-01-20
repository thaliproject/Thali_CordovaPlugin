'use strict';

var throttle = require('lodash.throttle');
var logger = require('../../ThaliLogger')('pouchDBCheckpointsPlugin');
var makeAsync = require('./common').makeAsync;

module.exports.onCheckpointReached = function (handler) {
  var db = this; // eslint-disable-line consistent-this
  var plugin = db.__checkpointPlugin;

  if (!plugin) {
    plugin = db.__checkpointPlugin = new CheckpointPlugin(db);
  }

  plugin.registerHandler(handler);
};

var DEFAULT_DELAY = 200;

function CheckpointPlugin (_db) {
  // Private data
  var db = _db;
  var checkpoint = db.__opts.checkpoint;
  var delay = db.__opts.checkpointDelay || DEFAULT_DELAY;
  var handlers = [];
  var destroyed = false;

  // Private methods
  function checkDBSize () {
    // We want to call 'getDiskSize' directly without ignoring errors.
    // https://github.com/pouchdb/pouchdb-size/issues/22
    return db.getDiskSize()
      .then(function (diskSize) {
        // Handlers should be called only once
        // after the first reaching of a checkpoint.
        if (diskSize >= checkpoint) {
          handlers.forEach(function (handler) {
            handler(checkpoint);
          });
        }
      })
      .catch(function (error) {
        if (destroyed) {
          // ignore error if db has been destroyed
          logger.debug('Database has been destroyed in the middle of the ' +
            'size calculating');
          return;
        }
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
        'Please add pouchdb-size plugin before this one.'
      );
    }

    var checkDBSizeThrottled = throttle(checkDBSize, delay, {
      leading: false
    });

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
      .on('change', checkDBSizeThrottled);

    db.on('destroyed', function () {
      destroyed = true;
      checkDBSizeThrottled.cancel();
      changes.cancel();
    });
  }

  // Public methods
  CheckpointPlugin.prototype.registerHandler = function (handler) {
    // It might be better for performance
    // to execute handlers asynchronously.
    handlers.push(makeAsync(handler));
  };

  return new CheckpointPlugin();
};
