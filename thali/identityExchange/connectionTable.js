'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var ThaliReplicationManager = require('../thalireplicationmanager');

inherits(ConnectionTable, EventEmitter);

ConnectionTable.prototype.thaliReplicationManager = null;
ConnectionTable.prototype.connectionTable = {};
ConnectionTable.prototype.connectionSuccessListener = null;
ConnectionTable.prototype.cleanUpWasCalled = false;
ConnectionTable.prototype.cleanUpCalledErrorMessage = "Cleanup was called, this table is no longer live.";

ConnectionTable.prototype.lookUpPeerId = function(peerId, lastTime) {
    if (this.cleanUpWasCalled) {
        throw new Error(this.cleanUpCalledErrorMessage);
    }

    var tableEntry = this.connectionTable[peerId];

    tableEntry = tableEntry === undefined ? null : tableEntry;

    if (!tableEntry || !lastTime) {
        return tableEntry;
    }

    return tableEntry.time > lastTime ? tableEntry : null;
};

ConnectionTable.prototype.cleanUp = function() {
    this.cleanUpWasCalled = true;
    this.thaliReplicationManager.removeListener(ThaliReplicationManager.events.CONNECTION_SUCCESS,
        this.connectionSuccessListener);
};

/**
 * A temporary hack to collect connectionSuccess events. Once we put in ACLs we won't need this hack anymore.
 * @param thaliReplicationManager
 * @constructor
 */
function ConnectionTable(thaliReplicationManager) {
    EventEmitter.call(this);
    var self = this;
    this.thaliReplicationManager = thaliReplicationManager;
    this.connectionTable = {};
    this.connectionSuccessListener = function (successObject) {
        self.connectionTable[successObject.peerIdentifier] = {
            muxPort: successObject.muxPort,
            time: Date.now()
        };

        self.emit(successObject.peerIdentifier, self.connectionTable[successObject.peerIdentifier]);
    };
    thaliReplicationManager.on(ThaliReplicationManager.events.CONNECTION_SUCCESS, this.connectionSuccessListener);
}

module.exports = ConnectionTable;

