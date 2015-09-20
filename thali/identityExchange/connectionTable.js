'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var ThaliReplicationManager = require('../thalireplicationmanager');

inherits(ConnectionTable, EventEmitter);
/**
 * A temporary hack to collect connectionSuccess events. Once we put in ACLs we won't need this hack anymore.
 * @param replicationManager
 * @constructor
 */
function ConnectionTable(replicationManager) {
    EventEmitter.call(this);
    var self = this;
    this._replicationManager = replicationManager;
    this._connectionTable = {};
    this._connectionSuccessListener = function (successObject) {
        self._connectionTable[successObject.peerIdentifier] = {
            muxPort: successObject.muxPort,
            time: Date.now()
        };

        self.emit(successObject.peerIdentifier, self._connectionTable[successObject.peerIdentifier]);
    };
    replicationManager.on(ThaliReplicationManager.events.CONNECTION_SUCCESS, this._connectionSuccessListener);
}

ConnectionTable.prototype._replicationManager = null;
ConnectionTable.prototype._connectionTable = {};
ConnectionTable.prototype._connectionSuccessListener = null;
ConnectionTable.prototype._cleanUpWasCalled = false;
ConnectionTable.prototype.cleanUpCalledErrorMessage = "Cleanup was called, this table is no longer live.";

ConnectionTable.prototype.lookUpPeerId = function(peerId, lastTime) {
    if (this._cleanUpWasCalled) {
        throw new Error(this.cleanUpCalledErrorMessage);
    }

    var tableEntry = this._connectionTable[peerId];

    tableEntry = tableEntry === undefined ? null : tableEntry;

    if (!tableEntry || !lastTime) {
        return tableEntry;
    }

    return tableEntry.time > lastTime ? tableEntry : null;
};

ConnectionTable.prototype.cleanUp = function() {
    this._cleanUpWasCalled = true;
    this._replicationManager.removeListener(ThaliReplicationManager.events.CONNECTION_SUCCESS,
        this._connectionSuccessListener);
};

module.exports = ConnectionTable;

