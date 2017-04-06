'use strict';

var sinon   = require('sinon');

function sinonTest (callback) {
  return function (t) {
    var config = sinon.getConfig(sinon.config);
    config.injectInto = config.injectIntoThis && this || config.injectInto;
    var sandbox = sinon.sandbox.create(config);
    var args = Array.prototype.slice.call(arguments);
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

    return callback.apply(this, args.concat(sandbox.args));
  };
}

module.exports = sinonTest;
