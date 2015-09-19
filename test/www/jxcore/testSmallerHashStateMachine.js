'use strict';

var tape = require('wrapping-tape');
var SmallerHashStateMachine = require('thali/identityExchange/SmallerHashStateMachine');
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

inherits(MockConnectionTable, EventEmitter);
function MockConnectionTable(peerId, async) {
    EventEmitter.call(this);
    if (peerId && !async) {
        this.syncPeerId = peerId;
    }

    if (peerId && async) {
        this.asyncPeerId = peerId;
    }
}

MockConnectionTable.prototype.syncPeerId = null;
MockConnectionTable.prototype.asyncPeerId = null;
MockConnectionTable.prototype.lookUpPeerId = function() {
    if (!this.asyncPeerId) {
        this.emit(this.asyncPeerId);
        return;
    }

    return this.syncPeerId;
};

var smallHash = new Buffer("000000");
var bigHash = new Buffer("111111");

test('Make sure we exit when our hash is bigger', function (t) {
    var stateMachineInExit =
        new SmallerHashStateMachine(null, new MockConnectionTable(), null, smallHash, bigHash);
    stateMachineInExit.on(SmallerHashStateMachine.Events.Exited, function() {
        t.equal(stateMachineInExit.smallHashStateMachine.current, "Exit");
        t.end();
    });
    stateMachineInExit.start();
});

test('Make sure we start when our hash is smaller', function(t) {
    var stateMachineStarting =
        new SmallerHashStateMachine(null, new MockConnectionTable(), null, bigHash, smallHash);
    stateMachineStarting.on(SmallerHashStateMachine.Events.SearchStarted, function() {
        t.equal(stateMachineStarting.smallHashStateMachine.current, "GetPeerIdPort");
        t.end();
    });
    stateMachineStarting.start();
});