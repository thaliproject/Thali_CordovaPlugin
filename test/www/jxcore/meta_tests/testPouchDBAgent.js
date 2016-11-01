'use strict';

var ForeverAgent   = require('forever-agent');
var express        = require('express');
var expressPouchDB = require('express-pouchdb');
var http           = require('http');

var tape      = require('../lib/thaliTape');
var testUtils = require('../lib/testUtils');

var PouchDB = testUtils.getLevelDownPouchDb();


var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

test('a', function (t) {
  var agent = new ForeverAgent();

  var app = express();
  app.use('/db', expressPouchDB(PouchDB));

  var server = http.createServer(app);
  server.listen(0, function () {
    var port  = server.address().port;
    var url   = 'http://localhost:' + port + '/db/fit';
    var db    = new PouchDB(url , {
      ajax: {
        agent: agent
      }
    });
    console.log(db.__opts.ajax.agent === agent);
    db.get('fit')
      .then(function () {
        t.pass('ok');
        t.end();
      })
      .catch(function (error) {
        console.error('got error', error);
        t.fail('got error' + error);
        t.end();
      });
  });
});
