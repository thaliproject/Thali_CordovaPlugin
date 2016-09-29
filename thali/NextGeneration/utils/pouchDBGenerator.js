'use strict';

var inherits     = require('inherits');
var extend       = require('js-extend').extend;
var EventEmitter = require('events').EventEmitter;


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

    opts = extend({}, opts);

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

  options = extend({}, options);

  // This is a workround for #970.
  var CustomEventEmitter = function () {
    return EventEmitter.apply(this, arguments);
  }

  inherits(CustomEventEmitter, EventEmitter);

  inherits(PouchAlt, PouchDB);

  PouchAlt.preferredAdapters = PouchDB.preferredAdapters.slice();
  Object.keys(PouchDB).forEach(function(key) {
    if (!(key in PouchAlt) ) {
      PouchAlt[key] = PouchDB[key];
    }
  });

  // This is a workaround for #870.
  PouchAlt.prototype.info = function () {
    var self = this;
    return PouchAlt.super_.prototype.info.apply(this, arguments)
    .catch(function () {
      return { update_seq: 0 };
    });
  }

  // This is a workaround for #970.
  PouchAlt.prototype.on =
  PouchAlt.prototype.addListener = function (type, listener) {
    var self = this;
    // We don't want PouchDB to catch our exception from 'listener'.
    // We want to cancel current PouchDB action and emit 'error' with exception.
    return PouchAlt.super_.prototype.addListener.call(this, type, function () {
      try {
        listener.apply(this, arguments);
      } catch (e) {
        self.emit('error', e);
      }
    });
  }

  // This is a workaround for #970.
  // 'Changes' has an 'EventEmitter' too, but it isn't exported.
  // We have to overwrite 'EventEmitter' methods here.
  PouchAlt.prototype.changes = function () {
    var changes = PouchAlt.super_.prototype.changes.apply(this, arguments);
    // 'Changes' has its own 'addListener' method, we shouldn't overwrite it.
    // This method is based on 'EventEmitter.prototype.on' method.
    changes.on  = PouchAlt.prototype.on.bind(changes);
    return changes;
  };

  return PouchAlt;
}

module.exports = PouchDBGenerator;
