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

    if (typeof t.end === "function") {
	  t.end = function end(res) {
	    if (res) {
	      sandbox.restore();
	    } else {
	      sandbox.verifyAndRestore();
	    }
	  	tapeEnd(res);
	  };
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
