'use strict';

var CoreLeveldownAdapter = require('pouchdb-adapter-leveldb-core');

function LeveldownAdapter(opts, callback) {
  if (!opts.db) {
    return callback(new Error('leveldown is not defined'));
  }

  CoreLeveldownAdapter.call(this, opts, callback);
}

// overrides for normal LevelDB behavior on Node
LeveldownAdapter.valid = function () {
  return true;
};
LeveldownAdapter.use_prefix = false;

module.exports = function (PouchDB) {
  // We need to replace current leveldown adapter if it exists.
  var addPreferredAdapter = !PouchDB.adapters['leveldb'];
  PouchDB.adapter('leveldb', LeveldownAdapter, addPreferredAdapter);
};
