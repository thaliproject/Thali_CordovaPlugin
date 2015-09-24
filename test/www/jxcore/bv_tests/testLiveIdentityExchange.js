'use strict';

var tape = require('../lib/thali-tape');
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
            thaliServer = null;
            thaliApp = null;
        }
        t.end();
    }
});


test('Now do an identity Exchange with the real live system!', function(t) {
    if (!jxcore.utils.OSInfo().isMobile) {
        t.comment("Skipping test because we aren't running on a mobile platform");
        t.end();
        return;
    }

    var dbName = "thali";
    var thaliReplicationManager =
        new ThaliReplicationManager(new identityExchangeTestUtils.LevelDownPouchDB()(dbName));
    var identityExchange = new IdentityExchange(thaliApp, thaliServer.address().port, thaliReplicationManager,
        dbName);
    var peerToDoIdentityExchangeWith = null;
    thaliReplicationManager._emitter.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, function(peer) {
        t.comment("We found a peer - " + JSON.stringify(peer));
    });
    identityExchange.on(IdentityExchange.Events.PeerIdentityExchange, function(peer) {
        t.comment("We got a peer to do identity exchange with! - " + JSON.stringify(peer));
        if (!peerToDoIdentityExchangeWith && peer.isAvailable) {
            peerToDoIdentityExchangeWith = peer.peerIdentifier;
            t.comment("We are going to try and do an identity exchange with the peer");
            identityExchange.executeIdentityExchange(peer.peerIdentifier, peer.peerName, function(err, code) {
                t.notOk(err, "Did we get an error on executeIdentityExchange?");
                identityExchangeTestUtils.checkCode(t, code);
                identityExchange.stopExecutingIdentityExchange();
                identityExchange.stopIdentityExchange(function(err) {
                    t.notOk(err, "Did we get a problem in calling stop Identity Exchange?");
                    t.end();
                });
            })
        }
    });
    identityExchange.startIdentityExchange("Sreejumon", function(err) {
        t.notOk(err,"Did we successfully get a callback from start?");
    })
});