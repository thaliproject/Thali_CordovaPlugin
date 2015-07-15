var test = require('tape');

var PouchDB = require('pouchdb');

var ThaliEmitter = require('../thali/thaliemitter');
var ThaliReplicationManager = require('../thali/thalireplicationmanager');

test('ThaliEmitter can call startBroadcasting and endBroadcasting without error', function (t) {
  var e = new ThaliEmitter();

  t.plan(2);
  t.timeoutAfter(5000); // Give it 5 seconds

  e.startBroadcasting(String(Date.now), 9001, function (err1) {
    t.err(err1);

    e.stopBroadcasting(function (err2) {
      t.err(err2);
    });
  });
});
