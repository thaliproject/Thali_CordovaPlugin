'use strict';

module.exports.onCheckpointReached = function (handler) {
  if (!this.__checkpointPlugin) {
    initializeCheckpointPluginData.bind(this)();
  }

  addHandlerForCheckpointReached.bind(this)(handler);
};

var initializeCheckpointPluginData = function () {
  var plugin = this.__checkpointPlugin = {};

  plugin.delay = 500;
  plugin.handlers = [];
  plugin.callbacksAreNotified = false;

  initializeCheckpoint.bind(this)();
  initializeDBEvents.bind(this)();
  initializeSizeWrapper.bind(this)();
}

var addHandlerForCheckpointReached = function (handler) {
  var plugin = this.__checkpointPlugin;

  plugin.handlers.push(handler);
};

var initializeCheckpoint = function () {
  var plugin = this.__checkpointPlugin;

  plugin.checkpoint = this.__opts.checkpoint;
}

var initializeDBEvents = function () {
  var plugin = this.__checkpointPlugin;
  var delay = plugin.delay;

  plugin.events = this.changes({
    live: true,
    since: 'now'
  });

  plugin.events
    .on('change', callOnceAfterDelay(checkDBSize.bind(this), delay));

  this
    .on('destroyed', function () {
      plugin.events.cancel();
  });
};

var initializeSizeWrapper = function () {
  if (!this.installSizeWrapper) {
    throw new Error('This plugin depends on pouchdb-size plugin. Please add pouchdb-size plugin befor this one.');
  }

  this.installSizeWrapper();

  var plugin = this.__checkpointPlugin;
  plugin.sizeWrapperIsInitialized = true;
};

var checkDBSize = function () {
  var db = this;
  var plugin = this.__checkpointPlugin;

  return db.info()
    .then(function (response) {
      var dbSize = response.disk_size;
      var checkpoint = plugin.checkpoint;
      var callbacksAreCalled = plugin.callbacksAreCalled;

      // If a database shrinks after a callback has been already called
      // the callback should be called again when reaching a checkpoint
      if(callbacksAreCalled && dbSize < checkpoint) {
        plugin.callbacksAreCalled = false;
      }
      // Callback should be called only once
      // after the first reaching of a checkpoint
      if (!callbacksAreCalled && dbSize >= checkpoint) {
        plugin.handlers
          .forEach(function (handler) {
            handler(checkpoint);
          });

        plugin.callbacksAreCalled = true;
      }
    })
    .catch(function (error) {
      db.emit('error', error);
      console.log('Error while fetching db info: ', error);
    });
}

var callOnceAfterDelay = function (fn, delay) {
  var timeout = null;
  return function () {
    if (!timeout) {
      timeout = setTimeout(function () {
        fn();
        clearTimeout(timeout);
        timeout = null;
      }, delay);
    }
  }
}
