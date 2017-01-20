'use strict';

var tape = require('../lib/thaliTape');
var testUtils = require('../lib/testUtils');
var sinon = require('sinon');
var randomString = require('randomstring');

var logger = require('../lib/testLogger.js')('testPouchDBCheckpoint');

var PouchDB = testUtils.getLevelDownPouchDb()
  .plugin(require('pouchdb-size'))
  .plugin(require('thali/NextGeneration/utils/pouchDBCheckpointsPlugin'));

var db;
var dbName = testUtils.getRandomPouchDBName();
var dbOptions = {
  checkpoint: 500
};

var test = tape({
  setup: function (t) {
    db = new PouchDB(dbName, dbOptions);
    t.end();
  },
  teardown: function (t) {
    db.destroy()
      .catch(function (error) {
        t.fail(error);
      })
      .then(function () {
        t.end();
      });
  }
});

var Doc = function () {
  var prefix = randomString.generate({
    length: 4,
    charset: 'alphabetic'
  });
  this._id = prefix + '-' + Date.now();
};

test('Call of onCheckpointReached handler on a single db change', function (t) {
  db.onCheckpointReached(function () {
    t.end();
  });

  db.put(new Doc()).catch(t.end);
});

test('Call of multiple onCheckpointReached handlers on a single db change',
function (t) {
  var spy = sinon.spy();
  var anotherSpy = sinon.spy();

  var endTestIfBothSpiesWereCalledOnce = function (test) {
    if (spy.callCount > 1 || anotherSpy.callCount > 1) {
      test.end(
        'Each of onCheckpointReached handlers should be called exactly once'
      );
    }
    if (spy.calledOnce && anotherSpy.calledOnce) {
      test.end();
    }
  };

  db.onCheckpointReached(function () {
    spy();
    endTestIfBothSpiesWereCalledOnce(t);
  });
  db.onCheckpointReached(function () {
    anotherSpy();
    endTestIfBothSpiesWereCalledOnce(t);
  });

  db.put(new Doc()).catch(t.end);
});

test('Call of onCheckpointReached handler on multiple db changes ' +
'that are in the checkpoints plugin delay interval', function (t) {
  var ENSURE_DELAY = 1000;
  var spy = sinon.spy();

  db.onCheckpointReached(function () {
    spy();
    // Ensure that handler will not be called more then once
    setTimeout(function () {
      t.ok(spy.calledOnce, 'the checkpointReached handler should be ' +
        'called once. Called ' + spy.callCount + ' time(s)');
      t.end();
    }, ENSURE_DELAY);
  });

  var doc1 = new Doc();
  var doc2 = new Doc();
  db.put(doc1)
    // put some extra doc for 'change' event emission
    .then(function () {
      return db.put(doc2);
    })
    .catch(function (error) {
      t.end(error);
    });
});

test('Call of onCheckpointReached handler on multiple db changes ' +
    'that are out of the checkpoints plugin delay interval', function (t) {
  var spy = sinon.spy();

  var handler = function () {
    spy();
    if (spy.callCount === 2) {
      t.end();
    }

        // To trigger the handler again
    db.put(new Doc())
          .catch(function (error) {
            t.end(error);
          });
  };

  db.onCheckpointReached(handler);

  db.put(new Doc())
        .catch(function (error) {
          t.end(error);
        });
});

test('Can safely destroy db in the middle of the checkpoint delay interval',
  function (t) {
    var CHECKPOINT_DELAY = 100;

    var customDb = new PouchDB(testUtils.getRandomPouchDBName(), {
      checkpoint: 100,
      checkpointDelay: CHECKPOINT_DELAY
    });

    var checkpointCallbackSpy = sinon.spy();
    customDb.onCheckpointReached(checkpointCallbackSpy);

    var dbDestroyed = false;

    var changes = customDb.changes({ live: true, since: 'now' })
      .on('change', function () {
        // At this point checkpoint plugin already scheduled internal
        // checkDBSize function to be called after `checkpointDelay` interval.
        // We are going to destroy database before this function actually
        // called.
        var start = Date.now();
        customDb.destroy()
          .then(function () {
            dbDestroyed = true;
            var destroyTime = Date.now() - start;
            if (destroyTime >= CHECKPOINT_DELAY) {
              logger.warn('Destroying database takes too long. Try to ' +
                'increase CHECKPOINT_DELAY for this test');
            }

            // wait delay interval to make sure that checkpoint callback is not
            // called
            setTimeout(end, CHECKPOINT_DELAY);
          })
          .catch(endWithError);
      });

    customDb.put(new Doc()).catch(endWithError);

    function endWithError (error) {
      end(error || new Error('Unknown error'));
    }

    function end (error) {
      t.equal(checkpointCallbackSpy.callCount, 0,
        'checkpoint callback should not be called');
      t.ok(dbDestroyed, 'db should be destroyed');
      changes.cancel();
      t.end(error);
    }
  }
);

test('Can safely destroy db in the middle of its size calculating', function (t) {
  var customDb = new PouchDB(testUtils.getRandomPouchDBName(), {
    checkpoint: 100,
  });

  var checkpointCallbackSpy = sinon.spy();
  customDb.onCheckpointReached(checkpointCallbackSpy);

  var dbDestroyed = false;

  var originalGetDiskSize = customDb.getDiskSize;
  customDb.getDiskSize = function () {
    var self = this;
    var args = arguments;

    var result = customDb.destroy()
      .then(function () {
        dbDestroyed = true;
      })
      .catch(endWithError)
      .then(function () {
        return originalGetDiskSize.call(self, args);
      });

    result.catch(function () {
      return; // ignore all errors
    }).then(function () {
      // schedule end as a macrotask so it is performed after all promise chains
      // are processed
      setImmediate(end);
    });

    return result;
  };

  customDb.put(new Doc()).catch(endWithError);

  function endWithError (error) {
    end(error || new Error('Unknown error'));
  }

  function end (error) {
    t.equal(checkpointCallbackSpy.callCount, 0,
      'checkpoint callback should not be called');
    t.ok(dbDestroyed, 'db should be destroyed');
    t.end(error);
  }
});
