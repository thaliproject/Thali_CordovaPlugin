'use strict';
var PouchDB = require('pouchdb');

// TODO It probably should be in a separated config file
var customPouchDBEvents = {
  SIZE_CHECK_POINT_REACHED: 'sizeCheckpointReached'
};

module.exports = PouchDB
  .plugin(require('pouchdb-size'))
  .plugin(sizeCheckpointsPlugin);

var sizeCheckpointsPlugin = {
  on: function (event, handler) {
    console.log('DB opts: ', this.__opts);
    checkpoints = this.__opts.checkpoints || [];

    if (event === customPouchDBEvents.SIZE_CHECK_POINT_REACHED) {
      addEventHandlerForSizeCheckpointReached.bind(this)(handler);
    }
  }
};

var checkpoints;
var events;
var sizeWrapperInitialized;

var addEventHandlerForSizeCheckpointReached = function (handler) {
  if (!events) {
    initializeDBEvents.bind(this)();
  }

  if(!sizeWrapperInitialized) {
    initializeSizeWrapper.bind(this)();
  }

  var db = this;
  function checkDBSize () {
    console.log('DB was changed')
    db.info()
      .then(function (response) {
        console.log('Calling "info"')
        var reachedCheckpoint;
        var dbSize = response.disk_size;

        console.log('DB size is ', dbSize);
        checkpoints.forEach(function (checkpoint) {
          if (dbSize >= checkpoint) {
            reachedCheckpoint = checkpoint;
          }
        });

        console.log('Reached checkpoint', reachedCheckpoint);
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
  console.log('DB events initialized');
}

var initializeSizeWrapper = function () {
  this.installSizeWrapper();
  console.log('DB size wrapper initialized');
}
