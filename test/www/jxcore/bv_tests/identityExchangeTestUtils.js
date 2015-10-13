'use strict';

var PouchDB = require("pouchdb");
var path = require("path");
var os = require("os");
var ExpressPouchDB = require("express-pouchdb");
var Express = require("express");
var Promise = require('lie');
var crypto = require('crypto');
var identityExchangeUtils = require('thali/identityExchange/identityExchangeUtils');

exports.LevelDownPouchDB = function() {
  var dbPath = path.join(os.tmpdir(), 'dbPath');
  return process.platform === 'android' || process.platform === 'ios' ?
    PouchDB.defaults({db: require('leveldown-mobile'), prefix: dbPath}) :
    PouchDB.defaults({db: require('leveldown'), prefix: dbPath});
};

exports.createThaliAppServer = function() {
  var app = Express();

  app.use('/db', ExpressPouchDB(exports.LevelDownPouchDB(), { mode: 'minimumForPouchDB'}));

  return new Promise(function(resolve, reject) {
    app.listen(0, function() {
      this.on('error', function(err) {
        console.log("Server got error event: " + JSON.stringify(err));
      });
      resolve({ app: app, server: this });
    })
  });
};

exports.createSmallAndBigHash = function() {
  var random1 = crypto.randomBytes(identityExchangeUtils.pkBufferLength);
  var random2 = crypto.randomBytes(identityExchangeUtils.pkBufferLength);
  if (identityExchangeUtils.compareEqualSizeBuffers(random1, random2) > 0) {
    return { smallHash: random2, bigHash: random1};
  } else {
    return { smallHash: random1, bigHash: random2};
  }
};

exports.checkCode = function(t, code) {
  t.ok(typeof code === "number" && code >= 0 && code < 1000000, "We got a code, did it check out?");
}
