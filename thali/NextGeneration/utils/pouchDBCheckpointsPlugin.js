'use strict';

module.exports = {
  onCheckpointReached: function (handler) {
    checkpoints = this.__opts.checkpoints || [];

    addEventHandlerForCheckpointReached.bind(this)(handler);
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
      })
      .catch(function (error) {
        console.log('Error while fetching db info: ', error);
      });
  }

  events.on('change', checkDBSize);
}

var initializeDBEvents = function () {
  events = this.changes({
    live: true,
    since: 'now'
  });

  this.on('destroyed', function () {
    events.cancel();
  });
}

var initializeSizeWrapper = function () {
  if (!this.installSizeWrapper) {
    throw new Error('This plugin depends on pouchdb-size plugin. Please add pouchdb-size plugin befor this one.');
  }

  this.installSizeWrapper();
  console.log('pouchdb-size plugin installed');
}
