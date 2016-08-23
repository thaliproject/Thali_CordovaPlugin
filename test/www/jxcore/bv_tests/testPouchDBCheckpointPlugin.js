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
var DEFAULT_DELAY = 200;
var CALCULATING_DELAY = 100;

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
  var spy = sinon.spy();

  db.onCheckpointReached(spy);

  db.put(new Doc())
    .then(function () {
      // A small delay is needed to calculate database size after put
      setTimeout(function () {
        t.ok(spy.calledOnce, 'checkpointReached handler should be called once. Called ' + spy.callCount + ' time(s)');
        t.end();
      }, DEFAULT_DELAY + CALCULATING_DELAY);
    })
    .catch(function (error) {
      t.fail(error);
    });
});

test('Call of multiple onCheckpointReached handlers on a single db change', function (t) {
  var spy = sinon.spy();
  var anotherSpy = sinon.spy();

  db.onCheckpointReached(spy);
  db.onCheckpointReached(anotherSpy);

  db.put(new Doc())
    .then(function () {
      // A small delay is needed to calculate database size after put
      setTimeout(function () {
        t.ok(spy.calledOnce, 'The checkpointReached handler should be called once. Called ' + spy.callCount + ' time(s)');
        t.ok(anotherSpy.calledOnce, 'The checkpointReached handler should be called once. Called ' + anotherSpy.callCount + ' time(s)');
        t.end();
      }, DEFAULT_DELAY + CALCULATING_DELAY);
    })
    .catch(function (error) {
      t.fail(error);
    });
});

test('Call of onCheckpointReached handler on multiple db changes' +
'that are in the checkpoints plugin delay interval', function (t) {
    var spy = sinon.spy();

    db.onCheckpointReached(spy);

    db.put(new Doc())
      // put some extra docs for 'change' event emission
      .then(function () {
        return db.put(new Doc());
      })
      .then(function () {
        return db.put(new Doc());
      })
      .then(function () {
        // A small delay is needed to calculate database size after put
        setTimeout(function () {
          t.ok(spy.calledOnce, 'the checkpointReached handler should be called once. Called ' + spy.callCount + ' time(s)');
          t.end();
        }, DEFAULT_DELAY + CALCULATING_DELAY);
      })
      .catch(function (error) {
        t.fail(error);
      });
    });

//  TODO Investigate how to force PouchDB to shrink database size
//  Atfer that test can be enabled
/*
test('Call of onCheckpointReached handler after database shrinks', function (t) {
  var spy = sinon.spy();
  var doc = new Doc();

  db.onCheckpointReached(spy);

  db.put(doc)
    .then(function (res) {
      return db.get(res.id);
    })
    .then(function (doc) {
      return db.remove(doc);
    })
    .then(function () {
      return db.compact();
    })
    .then(function () {
      // Get first handler call
      setTimeout(function () {
        db.put(new Doc())
          .then(function () {
            // Get second handler call
            setTimeout(function () {
              t.ok(spy.calledTwice, 'The checkpointReached handler should be called twice');
              t.end();
            }, DEFAULT_DELAY + CALCULATING_DELAY)
          })
          .catch(function (error) {
            t.fail(error);
          });
      }, DEFAULT_DELAY + CALCULATING_DELAY);

    })
    .catch(function (error) {
      t.fail(error);
    });
});
*/
