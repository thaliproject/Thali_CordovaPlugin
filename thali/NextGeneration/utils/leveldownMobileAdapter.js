'use strict';

var CoreLeveldownAdapter = require('pouchdb-adapter-leveldb-core');

function LeveldownMobileAdapter(opts, callback) {
  if (!opts.db) {
    return callback(new Error('leveldown is not defined'));
  }

  CoreLeveldownAdapter.call(this, opts, callback);
}

// overrides for normal LevelDB behavior on Node
LeveldownMobileAdapter.valid = function () {
  return true;
};
LeveldownMobileAdapter.use_prefix = false;

module.exports = function (PouchDB) {
  PouchDB.adapter('leveldb-mobile', LeveldownMobileAdapter, true);
};
