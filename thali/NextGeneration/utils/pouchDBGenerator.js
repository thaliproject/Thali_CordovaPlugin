'use strict';

var inherits = require('inherits');
var extend = require('js-extend').extend;


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

    opts = extend({}, opts);

    // workaround start
    if (name !== undefined && name.indexOf('http') !== 0 && name.indexOf('https') !== 0) {
      if (! opts.db) {
        opts.db = require(options.adapter);
      }

      if (! opts.prefix) {
        opts.prefix = defaultDirectory;
      }
    }
    // workaround end

    PouchDB.call(this, name, opts, callback);
  }

  options = extend({}, PouchDBGenerator.defaults, options);
  
  inherits(PouchAlt, PouchDB);

  PouchAlt.preferredAdapters = PouchDB.preferredAdapters.slice();
  Object.keys(PouchDB).forEach(function(key) {
    if (! (key in PouchAlt) ) {
      PouchAlt[key] = PouchDB[key];
    }
  });

  return PouchAlt;
}

PouchDBGenerator.defaults = {
  adapter: 'leveldown-mobile'
};

module.exports = PouchDBGenerator;
