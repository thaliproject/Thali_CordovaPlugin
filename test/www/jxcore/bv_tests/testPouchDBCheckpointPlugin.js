'use strict';

var tape = require('../lib/thaliTape');
var sinon = require('sinon');

var fs = require('fs-extra-promise');
var PouchDB = require('pouchdb')
  .plugin(require('pouchdb-size'))
  .plugin(require('thali/NextGeneration/utils/pouchDBCheckpointsPlugin'))
  .defaults({
    defaultAdapter: require('leveldown-mobile');
  });

// DB defaultDirectory should be unique among all tests
// and any instance of this test.
// This is especially required for tape.coordinated.
var dbName = 'pouchdb-' + Date.now();
var checkpoints = [10, 20, 30];
var dbOptions = {
  checkpoints: checkpoints
};

var test = tape({
  setup: function (t) {
    fs.ensureDirSync(dbName);
    t.end();
  },
  teardown: function (t) {
    fs.removeSync(dbName);
    t.end();
  }
});

var uniqDocument = {
  _id: Date.now().toString()
};

test('checkPointReached event emission', function (t) {
  var db = new PouchDB(dbName, dbOptions);
  var spy = sinon.spy();

  db.on('sizeCheckPointReached', spy);

  db.put(uniqDocument)
    .then(function () {
      t.ok(spy.calledOnce, 'checkPointReached event should be once emitted')
      t.end();
    })
    .catch(function (error) {
      t.fail('Should not get here', error);
    });
});
