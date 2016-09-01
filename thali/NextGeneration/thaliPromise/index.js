/**
 * @module thaliPromise
 *
 * This is a wrapper for any promise library that should be used
 * by thali project
 *
 * Motivation:
 * For production it's better to use lightweight libraries
 * that just do their work well without extra functionality (e.g. `lie`).
 *
 * For debugging and  development it's better to use more powerful libraries
 * with additional features such as long stack traces (e.g `bluebird`, `q`).
 */
var Promise = require('lie');
// Uncomment for debugging with long stack traces
/*
var Promise = require('bluebird');
Promise.config({
    longStackTraces: true
  });
*/
module.exports = Promise;