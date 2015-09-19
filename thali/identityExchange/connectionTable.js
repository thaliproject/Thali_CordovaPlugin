'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

inherits(ConnectionTable, EventEmitter);
function ConnectionTable(replicationManager) {
    EventEmitter.call(this);
    var self = this;
    this._replicationManager = replicationManager;
    this._connectionTable = {};
    this._connectionSuccessListener = function (successObject) {
        this._connectionTable[successObject.peerIdentifier] = {
            muxPort: successObject.muxPort,
            time: Date.now()
        };

        self.emit(successObject.peerIdentifier, this._connectionTable[successObject.peerIdentifier]);
    };
    replicationManager.on(replicationManager.events.CONNECTION_SUCCESS, this._connectionSuccessListener);
}

ConnectionTable.prototype._replicationManager = null;
ConnectionTable.prototype._connectionTable = {};
ConnectionTable.prototype._connectionSuccessListener = null;
ConnectionTable.prototype._cleanUpWasCalled = false;

ConnectionTable.prototype.lookUpPeerId = function(peerId, lastTime) {
    if (this._cleanUpWasCalled) {
        throw new Error("Cleanup was called, this table is no longer live.");
    }

    var tableEntry = this._connectionTable[peerId];

    if (!tableEntry || !lastTime) {
        return tableEntry;
    }

    return tableEntry.time > lastTime ? tableEntry : null;
};

ConnectionTable.prototype.cleanUp = function() {
    this._cleanUpWasCalled = true;
    this._replicationManager.removeListener(this._replicationManager.events.CONNECTION_SUCCESS,
        this._connectionSuccessListener);
};

module.exports = ConnectionTable;

