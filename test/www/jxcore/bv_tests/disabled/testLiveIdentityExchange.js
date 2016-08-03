'use strict';

var tape = require('../lib/thaliTape');
var IdentityExchange = require('thali/identityExchange/identityexchange');
var identityExchangeTestUtils = require('./identityExchangeTestUtils');
var ThaliReplicationManager = require('thali/thalireplicationmanager');
var ThaliEmitter = require('thali/thaliemitter');

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
    }
    thaliServer = null;
    thaliApp = null;
    t.end();
  }
});


test('Now do an identity Exchange with the real live system!', function(t) {
  if (!jxcore.utils.OSInfo().isMobile) {
    t.pass(("Skipping test because we aren't running on a mobile platform");
    t.end();
    return;
  }

  var dbName = "thali";
  var levelDownPouchDB = identityExchangeTestUtils.LevelDownPouchDB();
  var thaliReplicationManager =
    new ThaliReplicationManager(new levelDownPouchDB(dbName));
  var identityExchange = new IdentityExchange(thaliApp, thaliServer.address().port, thaliReplicationManager,
    dbName);
  thaliReplicationManager._emitter.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, function(peer) {
    t.pass(("We found a peer - " + JSON.stringify(peer));
  });
  var peerIdentityExchangeHandler = function(peer) {
    t.pass(("We got a peer to do identity exchange with! - " + JSON.stringify(peer));
    if (peer.peerAvailable) {
      identityExchange.removeListener(IdentityExchange.Events.PeerIdentityExchange,
        peerIdentityExchangeHandler);
      t.pass(("We are going to try and do an identity exchange with the peer");
      identityExchange.executeIdentityExchange(peer.peerIdentifier, peer.peerName, function(err, code) {
        t.notOk(err, "Did we get an error on executeIdentityExchange?");
        identityExchangeTestUtils.checkCode(t, code);
        // The side with the larger hash can end up quiting fast enough to kill the connection
        // before the response goes back causing a hang on the side with the smaller hash. So we
        // put in a delay to make sure everything gets through.
        setTimeout(function() {
          identityExchange.stopExecutingIdentityExchange();
          identityExchange.stopIdentityExchange(function(err) {
            t.notOk(err, "Did we get a problem in calling stop Identity Exchange?");
            t.end();
          });
        }, 200)
      })
    }
  };
  identityExchange.on(IdentityExchange.Events.PeerIdentityExchange, peerIdentityExchangeHandler);
  identityExchange.startIdentityExchange("Sreejumon", function(err) {
    t.notOk(err,"Did we successfully get a callback from start?");
  })
});
