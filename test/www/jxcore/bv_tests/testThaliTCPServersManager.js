'use strict';

var tape = require('../lib/thali-tape');
var ThaliTCPServersManager = require('thali/NextGeneration/tcpServersManager');

var test = tape({
  setup: function(t) {
    console.log("su");
    t.end();
  },
  teardown: function(t) {
    console.log("td");
    t.end();
  }
});

test("can create servers manager", function(t) {
  var manager = new ThaliTCPServersManager(4242);
  t.ok(manager != null, "manager must not be null");
  t.ok(typeof manager == 'object', "manager must be an object");
  t.end();
});

test("can start/stop servers manager", function(t) {
  var serversManager = new ThaliTCPServersManager(4242);
  serversManager.start()
  .then(function(localPort) {
    t.ok(localPort > 0 && localPort <= 65535, 'port must be in range');
    serversManager.stop();
    t.end();
  })
  .catch(function(err) {
    t.fail("should not get error - " + err);
    serversManager.stop();
  });
});
