'use strict';

var sinon   = require('sinon');

function sinonTest (callback) {
  return function (t) {
  	var slice = Array.prototype.slice;
  	var config = sinon.getConfig(sinon.config);
    config.injectInto = config.injectIntoThis && this || config.injectInto;
    var sandbox = sinon.sandbox.create(config);
    var args = slice.call(arguments);
    var result;
    var ok;

    if (typeof t.end === 'function') {
      t.on('result', function(res) {
        ok = res.ok;
      });

      t.on('end', function() {
        if (!ok) {
          sandbox.restore();
        } else {
          sandbox.verifyAndRestore();
        }
      });
  	}

    try {
      result = callback.apply(this, args.concat(sandbox.args));
    } catch (e) {
      t.fail(e);
    }
    return result;
  };
}

module.exports = sinonTest;
