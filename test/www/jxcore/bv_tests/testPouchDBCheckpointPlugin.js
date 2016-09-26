'use strict';

var tape = require('../lib/thaliTape');
var sinon = require('sinon');

var fs = require('fs-extra-promise');
var PouchDB = require('pouchdb')
  .plugin(require('pouchdb-size'))
  .plugin(require('thali/NextGeneration/utils/pouchDBCheckpointsPlugin'))
  .defaults({
     db: require('leveldown-mobile')
   });

// DB directory should be unique among all tests and any instance of this test.
// This is especially required for tape.coordinated.
var db;
var dbName = 'pouchdb-uuid:' + Math.random();
var dbOptions = {
  checkpoint: 500
};

var test = tape({
  setup: function (t) {
    db = new PouchDB(dbName, dbOptions);
    t.end()
  },
  teardown: function (t) {
    db.destroy()
      .then(function () {
        fs.removeSync(dbName);
        t.end();
      })
      .catch(function (error) {
        t.fail(error);
      });
  }
});

var Doc = function () {
  this._id = Date.now().toString()
};

test('Call of onCheckpointReached handler on a single db change', function (t) {
  db.onCheckpointReached(function () {
    t.end();
  });

  db.put(new Doc())
    .catch(function (error) {
      t.fail(error);
    });
});

test('Call of multiple onCheckpointReached handlers on a single db change',
  function (t) {
    var spy = sinon.spy();
    var anotherSpy = sinon.spy();

    var endTestIfBothSpiesWereCalledOnce = function (test) {
      if (spy.calledOnce && anotherSpy.calledOnce) {
        test.end();
      }
      if (spy.callCount > 1 || anotherSpy.callCount > 1) {
        test.fail('Each of onCheckpointReached handlers should be called once');
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

    db.put(new Doc())
      .catch(function (error) {
        t.fail(error);
      });
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

    db.put(new Doc())
      // put some extra doc for 'change' event emission
      .then(function () {
        return db.put(new Doc());
      })
      .catch(function (error) {
        t.fail(error);
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
            t.fail(error);
          });
      };

      db.onCheckpointReached(handler);

      db.put(new Doc())
        .catch(function (error) {
          t.fail(error);
        });
  });