'use strict';

var Promise        = require('bluebird');
var objectAssign   = require('object-assign');
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

test('PouchDB agent works as expected', function (t) {
  var agent = new ForeverAgent();

  var requestsData = [];
  var _addRequest = agent.addRequest;
  agent.addRequest = function (data) {
    requestsData.push(objectAssign({}, data));
    return _addRequest.apply(this, arguments);
  }

  var app = express();
  app.use('/db', expressPouchDB(PouchDB));

  var server = http.createServer(app);
  server.listen(0, function () {
    var port  = server.address().port;
    var url   = 'http://localhost:' + port + '/db';
    var db    = new PouchDB(url , {
      ajax: {
        agent: agent
      }
    });

    function query(name) {
      return db.get(name)
        .then(function () {
          t.fail('we should not find a document');
        })
        .catch(function (error) {
          t.ok(error, 'error is not empty');
          t.equals(error.status, 404, 'status should be 404');
        })
        .then(function () {
          var lastData = requestsData[requestsData.length - 1];
          t.equals(lastData.method, 'GET', 'method is \'get\'');
          t.equals(lastData.path, '/db/' + name + '?', 'path is ok');
        });
    }

    query('fit')
      .then(function () {
        return query('foo');
      })
      .then(function () {
        t.ok(requestsData.length > 2, 'we should call agent more than twice');
        t.end();
      });
  });
});
