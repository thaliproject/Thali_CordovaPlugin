'use strict';

var tape = require('../lib/thaliTape');
var ConnectionTable = require('thali/identityExchange/connectionTable');
var ThaliReplicationManager = require('thali/thalireplicationmanager');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

// test setup & teardown activities
var test = tape({
    setup: function(t) {
        t.end();
    },
    teardown: function(t) {
        t.end();
    }
});

function createAnnounce(peerId, muxPort) {
    return { peerIdentifier: peerId, muxPort: muxPort }
}

var peersToAnnounce = [
    createAnnounce("a", 30),
    createAnnounce("b", 40),
    createAnnounce("a", 50),
    createAnnounce("c", 60)
];

var results = [
    { peerId: "a", port: 50 },
    { peerId: "b", port: 40 },
    { peerId: "c", port: 60 }
];

test('test connectionTable table building and cleanup', function (t) {
    var thaliReplicationManager = new ThaliReplicationManager("bogus", "bogus");
    var connectionTable = new ConnectionTable(thaliReplicationManager);

    var timeBeforeEmit = Date.now();

    peersToAnnounce.forEach(function(announce) {
        thaliReplicationManager.emit(ThaliReplicationManager.events.CONNECTION_SUCCESS, announce);
    });

    var timeAfterEmit = Date.now();

    results.forEach(function(result) {
        var lookup = connectionTable.lookUpPeerId(result.peerId);
        t.equal(lookup.muxPort, result.port);
        t.ok(lookup.time >= timeBeforeEmit && lookup.time <= timeAfterEmit);
    });

    t.equal(null, connectionTable.lookUpPeerId("d"));
    t.equal(null, connectionTable.lookUpPeerId("a", Date.now() + 100));
    t.ok(connectionTable.lookUpPeerId("c", 0));

    connectionTable.cleanUp();
    t.throws(function() { connectionTable.lookUpPeerId("a") }, connectionTable.cleanUpCalledErrorMessage);
    t.end();
});

test('test connectionTable emitting events for peerIds', function(t) {
    var thaliReplicationManager = new ThaliReplicationManager("bogus", "bogus");
    var connectionTable = new ConnectionTable(thaliReplicationManager);

    var connectionTableListenersThatRan = 0;

    peersToAnnounce.forEach(function(announce) {
        var timeBeforeEmit = Date.now()
        var listener = function(tableEntry) {
            t.equal(announce.muxPort, tableEntry.muxPort);
            t.ok(tableEntry.time >= timeBeforeEmit && tableEntry.time <= timeBeforeEmit + 100);

            connectionTable.removeListener(announce.peerIdentifier, listener);

            connectionTableListenersThatRan += 1;
            if (connectionTableListenersThatRan == peersToAnnounce.length) {
                t.end();
            }
        };
        connectionTable.on(announce.peerIdentifier, listener);
        thaliReplicationManager.emit(ThaliReplicationManager.events.CONNECTION_SUCCESS, announce);
    });
});
