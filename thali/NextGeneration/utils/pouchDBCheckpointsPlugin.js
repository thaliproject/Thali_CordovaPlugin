'use strict';

// TODO It probably should be in a separated config file
var customPouchDBEvents = {
  CHECK_POINT_REACHED: 'checkpointReached'
};

module.exports = {
  on: function (event, handler) {
    checkpoints = this.__opts.checkpoints || [];

    if (event === customPouchDBEvents.CHECK_POINT_REACHED) {
      addEventHandlerForCheckpointReached.bind(this)(handler);
    }
  }
};

var checkpoints;
var events;
var sizeWrapperInitialized;

var addEventHandlerForCheckpointReached = function (handler) {
  if (!events) {
    initializeDBEvents.bind(this)();
  }

  if(!sizeWrapperInitialized) {
    initializeSizeWrapper.bind(this)();
  }

  var db = this;
  function checkDBSize () {
    db.info()
      .then(function (response) {
        var reachedCheckpoint;
        var dbSize = response.disk_size;

        checkpoints.forEach(function (checkpoint) {
          if (dbSize >= checkpoint) {
            reachedCheckpoint = checkpoint;
          }
        });

        if (reachedCheckpoint) {
          handler(reachedCheckpoint);
        }
      });
  }

  events.on('change', checkDBSize);
}

var initializeDBEvents = function () {
  events = this.changes({
    live: true,
    since: 'now'
  });
}

var initializeSizeWrapper = function () {
  if (!this.installSizeWrapper) {
    throw new Error('This plugin depends on pouchdb-size plugin. Please add pouchdb-size plugin befor this one.');
  }

  this.installSizeWrapper();
}
