'use strict';

/** @module thaliSendNotificationBasedOnReplication */

/** @file This class monitors PouchDB and when it sees a change it will update
 * the notification beacons.
 *
 * Register Database - Database name, flat list of public keys to notify when
 * the DB changes. This will overwrite any existing values for the named
 * database. If the notification list is empty then the entry is removed
 * entirely.*
 *
 * The idea is that we have a window of time
 */

/**
 * We will only update the notification beacons every X milliseconds while the
 * app is in the foreground where X is defined below.
 *
 * @private
 * @type {number}
 */
var Update_Window_Foreground = 1000;

/**
 * We will only update the notification beacons every X milliseconds while the
 * app is in the background where X is defined below.
 *
 * @private
 * @type {number}
 */
var Update_Window_Background = 250;

function ThaliSendNotificationBasedOnReplication(
  thaliNotificationServer,
  pouchDBInstance) {

}

/**
 * We monitor the PouchDB database's change feed and when we receive a change
 * we have to know who to tell about it. We don't want to notify the person
 * who caused the change but we don't know who that is. So we use this callback
 * to let the programmer tell us who should we notify about this change.
 *
 * @callback ChangesFilter
 * @param {info} change This is the change object given to use by PouchDB
 * @returns {string[]} This is an array of strings holding
 * base64 url safe encoded ECDH public keys that are to be notified of this
 * change.
 */

/**
 * This is an interface for handling the cancel method on a
 * registered filter.
 *
 * @name CancelFilter
 * @class
 */

/**
 * This method cancels the associated filter. This method MUST be idempotent
 * so it can be safely called multiple times.
 *
 * @method
 * @name CancelFilter@cancel
 */

/**
 * This method causes us to monitor the named database and call the filter
 * every time there is an update. We will unify the list of returned public
 * keys over the current time window and use that unioned list to reset the
 * notification beacon values.
 *
 * It is allowed to call this method multiple times with the same dbName. But
 * we do not check if the same filter has been used before. Instead we will
 * just register the filter over and over again. If we have multiple filters
 * for the same database then we will union their outputs.
 *
 * When we get a call the first thing we will do is create an instance of
 * the database using the submitted PouchDB object and then call the Changes
 * function and register ourselves as a listener. We will register as a live
 * listener, we will include_docs including conflicts and attachments. We must
 * set return_docs to false to keep from blowing memory.
 *
 * When we register for the change event we will just call the associated
 * changesFilter. We will take the output from the filter calls for the same
 * DB and union them together. We will continue to do this until the current
 * time window ends and at that point if the unioned list isn't empty we will
 * update the notification beacons.
 *
 * @param {string} dbName This is the string that will be passed to the PouchDB
 * instance. The result database will then be monitored for changes.
 * @param {ChangesFilter} changesFilter
 * @returns {CancelFilter}
 */
ThaliSendNotificationBasedOnReplication.prototype.addFilter =
  function(dbName, changesFilter) {

};

module.exports = ThaliSendNotificationBasedOnReplication;
