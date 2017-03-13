'use strict';

var inherits     = require('inherits');
var EventEmitter = require('events').EventEmitter;
var assign       = require('object-assign');

var LeveldownAdapter = require('./leveldownMobileAdapter');


/**
 * Old PouchDB did care about database endpoint type before using prefix.
 * If endpoint was remote ('http' or 'https') it did not use prefix.
 * For example 5.3.0 https://github.com/pouchdb/pouchdb/blob/greenkeeper-chai-as-promised-5.3.0/src/constructor.js#L103
 * New PouchDB just prepends prefix to endpoint before resolving adapter.
 * For example 5.4.5 https://github.com/pouchdb/pouchdb/blob/5.4.5-branch/packages/pouchdb-core/src/constructor.js#L109
 * We should use prefix only for local endpoints.
 *
 * This is a Factory that returns modified PouchDB class.
 * Its instances will use specified prefix and adapter for local endpoint and
 * use nothing for remote endpoint.
 *
 * @public
 * @param {Object} PouchDB This is PouchDB class or something that inherits
 * PouchDB that should be fixed.
 * @param {string} defaultDirectory The prefix for local endpoint.
 * @param {Object} options Options with adapter for local endpoint. Generally
 * speaking this should contain {defaultAdapter: require('leveldown-mobile')}
 * for mobile platforms. Otherwise you'll get whatever the default adapter
 * is and for JXcore that would be leveldown (not leveldown-mobile) which
 * doesn't actually work.
 * @returns {PouchDB}
 */
function PouchDBGenerator(PouchDB, defaultDirectory, options) {
  // Shamelessly stolen from https://github.com/pouchdb/pouchdb/blob/e11a863a80ef746aba0fc3a0e235dbdf2048db5d/packages/node_modules/pouchdb-core/src/setup.js#L58-L90.

  function PouchAlt(name, opts) {
    if (!(this instanceof PouchAlt)) {
      return new PouchAlt(name, opts);
    }

    opts = opts || {};

    if (name && typeof name === 'object') {
      opts = name;
      name = opts.name;
      delete opts.name;
    }

    opts = assign({}, PouchAlt.__defaults, opts);

    // If database endpoint is not remote we will use defaultDirectory as
    // prefix and defaultAdapter as adapter for it.
    if (
      name !== undefined &&
      name.indexOf('http') !== 0 &&
      name.indexOf('https') !== 0
    ) {
      if (!opts.db && options.defaultAdapter) {
        opts.db      = options.defaultAdapter;
        opts.adapter = 'leveldb-mobile';
      }
      if (!opts.prefix) {
        opts.prefix = defaultDirectory;
      }
    }

    // Workaround for https://github.com/pouchdb/pouchdb-size/issues/23.
    this._db_name = name;

    PouchDB.call(this, name, opts);
  }

  options = assign({}, options);

  inherits(PouchAlt, PouchDB);

  PouchAlt.preferredAdapters = PouchDB.preferredAdapters.slice();
  Object.keys(PouchDB).forEach(function (key) {
    if (!(key in PouchAlt) ) {
      PouchAlt[key] = PouchDB[key];
    }
  });

  PouchAlt.__defaults = assign({}, PouchDB.__defaults);

  PouchAlt.adapter = function (id, obj, addToPreferredAdapters) {
    if (obj.valid()) {
      PouchAlt.adapters[id] = obj;
      if (addToPreferredAdapters) {
        PouchAlt.preferredAdapters.push(id);
      }
    }
  };

  PouchAlt.plugin = function (obj) {
    if (typeof obj === 'function') { // function style for plugins
      obj(PouchAlt);
    } else if (typeof obj !== 'object' || Object.keys(obj).length === 0) {
      throw new Error('Invalid plugin: got \"' + obj + '\", expected an object or a function');
    } else {
      Object.keys(obj).forEach(function (id) { // object style for plugins
        PouchAlt.prototype[id] = obj[id];
      });
    }
    return PouchAlt;
  }

  PouchAlt.plugin(LeveldownAdapter);

  return PouchAlt;
}

module.exports = PouchDBGenerator;
