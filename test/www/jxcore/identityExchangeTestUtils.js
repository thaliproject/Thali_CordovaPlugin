'use strict';

var PouchDB = require("pouchdb");
var path = require("path");
var os = require("os");
var ExpressPouchDB = require("express-pouchdb");
var Express = require("express");
var Promise = require('lie');
var crypto = require('crypto');
var identityExchangeUtils = require('thali/identityExchange/identityExchangeUtils');

exports.createThaliAppServer = function() {
    var dbPath = path.join(os.tmpdir(), 'dbPath');
    var LevelDownPouchDB = process.platform === 'android' || process.platform === 'ios' ?
        PouchDB.defaults({db: require('leveldown-mobile'), prefix: dbPath}) :
        PouchDB.defaults({db: require('leveldown'), prefix: dbPath});

    var app = Express();

    app.use('/db', ExpressPouchDB(LevelDownPouchDB, { mode: 'minimumForPouchDB'}));

    return new Promise(function(resolve, reject) {
        app.listen(0, function() {
            resolve({ app: app, server: this });
        })
    });
};

exports.createSmallAndBigHash = function() {
    var random1 = crypto.randomBytes(identityExchangeUtils.pkBufferLength);
    var random2 = crypto.randomBytes(identityExchangeUtils.pkBufferLength);
    if (random1.compare(random2) > 0) {
        return { smallHash: random2, bigHash: random1};
    } else {
        return { smallHash: random1, bigHash: random2};
    }
}