'use strict';

var tape = require('wrapping-tape');
var IdentityExchange = require('thali/identityExchange/identityexchange');
var identityExchangeTestUtils = require('./identityExchangeTestUtils');


var thaliApp = null;
var thaliServer = null;

function setUpServer() {
  return identityExchangeTestUtils.createThaliAppServer()
      .then(function(appAndServer) {
        thaliApp = appAndServer.app;
        thaliServer = appAndServer.server;
      }).catch(function(err) {
        throw err;
      });
}

var test = tape({
  setup: function(t) {
    setUpServer().then(function() {t.end()});
  },
  teardown: function(t) {
    if(thaliServer) {
      thaliServer.close();
      thaliServer = null;
      thaliApp = null;
    }
    t.end();
  }
});



// start with various bad friendly names
test('start with bad friendly names', function(t) {
  var badNames = ["", {}, null, "123456789012345678901"];
  badNames.forEach(function(badName) {
    var identityExchange = new IdentityExchange(thaliApp, null, null);
    identityExchange.startIdentityExchange(badName, function(err) {
      t.notEqual(err, null);
    });
  });
  t.end();
});

// after start make sure we get PeerIdentityExchange Events
//    then make sure we call start on replication manager with the correct discovery name
//    then make sure we get 400 NoIdentityExchange errors
//    then make sure we get callback.

// make sure we get an error if we call start and then immediately call stop

// after stop make sure we don't get PeerIdentityExchange events
//  make sure replication manager is stopped
//  make sure we get callback

// make sure we can't call onExecuteIdentityExchange without first calling start (try both from
//  constructor straight to onExecuteIdentityExchange as well as start -> stop -> onExecuteIdentityExchange
//  start -> stop -> onExecuteIdentityExchange -> stopExecuteIdentityExchange -> onExecuteIdentityExchange

// do an identity exchange where local device has smaller hash
//  make sure we get code

// do an identity exchange where local device has larger hash
//  set it up so we get two codes

