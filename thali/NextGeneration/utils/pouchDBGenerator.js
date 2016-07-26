'use strict';

var inherits = require('inherits');
var objectAssign = require('object-assign');


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
  // Shamelessly stolen from https://github.com/pouchdb/pouchdb/blob/fb77927d2f14911478032884f1576b770815bcab/packages/pouchdb-core/src/setup.js#L108-L137

  function PouchAlt(name, opts, callback) {
    if (!(this instanceof PouchAlt)) {
      return new PouchAlt(name, opts, callback);
    }

    if (typeof opts === 'function' || typeof opts === 'undefined') {
      callback = opts;
      opts = {};
    }

    if (name && typeof name === 'object') {
      opts = name;
      name = undefined;
    }

    opts = objectAssign({}, opts);

    // If database endpoint is not remote we are using defaultDirectory as
    // prefix and defaultAdapter as adapter for it.
    if (name !== undefined && name.indexOf('http') !== 0 &&
        name.indexOf('https') !== 0) {
      if (!opts.db && options.defaultAdapter) {
        opts.db = options.defaultAdapter;
      }
      if (!opts.prefix) {
        opts.prefix = defaultDirectory;
      }
    }

    PouchDB.call(this, name, opts, callback);
  }

  options = objectAssign({}, PouchDBGenerator.defaults, options);

  inherits(PouchAlt, PouchDB);

  PouchAlt.preferredAdapters = PouchDB.preferredAdapters.slice();
  Object.keys(PouchDB).forEach(function(key) {
    if (!(key in PouchAlt) ) {
      PouchAlt[key] = PouchDB[key];
    }
  });

  return PouchAlt;
}

PouchDBGenerator.defaults = {
  defaultAdapter: undefined
};

module.exports = PouchDBGenerator;
