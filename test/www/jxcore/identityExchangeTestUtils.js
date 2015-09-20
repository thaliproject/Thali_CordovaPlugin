'use strict';

var PouchDB = require("pouchdb");
var path = require("path");
var os = require("os");
var ExpressPouchDB = require("express-pouchdb");
var Express = require("express");
var Promise = require('lie');

exports.createThaliAppServer = function() {
    var dbPath = path.join(os.tmpdir(), 'dbPath');
    var LevelDownPouchDB = process.platform === 'android' || process.platform === 'ios' ?
        PouchDB.defaults({db: require('leveldown-mobile'), prefix: dbPath}) :
        PouchDB.defaults({db: require('leveldown'), prefix: dbPath});

    var app = Express();

    app.use('/db', ExpressPouchDB(LevelDownPouchDB, { mode: 'minimumForPouchDB'}));

    return new Promise(function(resolve, reject) {
        var server = app.listen(4999, function() {
            resolve(app, server);
        })
    });
};