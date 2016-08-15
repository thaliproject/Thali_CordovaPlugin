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

// DB defaultDirectory should be unique among all tests
// and any instance of this test.
// This is especially required for tape.coordinated.
var dbName = 'pouchdb-' + Date.now();
var checkpoints = [100, 200];
var dbOptions = {
  checkpoints: checkpoints
};
var db;

var test = tape({
  setup: function (t) {
    db = new PouchDB(dbName, dbOptions);
    t.end();
  },
  teardown: function (t) {
    fs.removeSync(dbName);
    t.end();
  }
});

var doc = {
  _id: Date.now().toString(),
  data: 'data'
};

test('onCheckpointReached callback calling', function (t) {
  var spy = sinon.spy();

  db.onCheckpointReached(spy);

  db.put(doc)
    .then(function () {
      // Small letency is need
      // because calculating of database size is a hard work
      setTimeout(function () {
        t.ok(spy.calledOnce, 'checkpointReached handler should be called once');
        t.end();
      }, 100);
    })
    .catch(function (error) {
      t.fail(error);
    });
});
