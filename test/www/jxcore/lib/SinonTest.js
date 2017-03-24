'use strict';

var util     = require('util');
var inherits = util.inherits;
var sinon   = require('sinon');
var asserts = require('./utils/asserts');
var logger = require('thali/ThaliLogger')('SinonTest');


function SinonTest (callback) {
  return function (t) {
  	var slice = Array.prototype.slice;
  	var config = sinon.getConfig(sinon.config);
    config.injectInto = config.injectIntoThis && this || config.injectInto;
    var sandbox = sinon.sandbox.create(config);
    var args = slice.call(arguments);
    var tapeEnd = t.end;
    var exception, result;
    var ok;

    if (typeof t.end === "function") {
      t.on("result", function(res) {
        ok = res.ok;
      })

      t.on("end", function(res) {
        if (!ok) {
          sandbox.restore();
        } else {
          sandbox.verifyAndRestore();
        }
      })
  	}

    try {
      result = callback.apply(this, args.concat(sandbox.args));
    } catch (e) {
      exception = e;
      t.fail(e);
    }
    return result;
  };
}

module.exports = SinonTest;
