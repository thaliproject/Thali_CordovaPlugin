'use strict';

var Promise = require('lie');

/** @module thaliSendNotificationBasedOnReplication */

/**
 * Used to manage the peer notification list.
 *
 * The primary copy of the notification list is kept in memory. However we also
 * persist a copy to our own PouchDB DB so that the list will persist across
 * reboots of the application.
 *
 * When called we must read in the record where we track the peers to notify
 * and if the record exists then we must use it to initialize our database.
 *
 * @private
 * @param {PouchDB} pouchDB
 * @constructor
 */
function _PeerNotificationListHandler(pouchDB) {

}

/**
 * The name of the database we will use to track the current peer notification
 * list.
 * @type {string}
 */

_PeerNotificationListHandler.PEER_NOTIFICATION_POUCHDB =
  'ThaliPeerNotificationDB';

/**
 * Replaces all the entries we are tracking with the submitted list. The list
 * is treated as being in order for purposes of handling limits on how many
 * peers we can notify.
 *
 * Before returning from this function we must issue a write onto the PouchDB
 * instance we are using to update the in order array of entries.
 *
 * BUGBUG: An obvious problem with this design is that if we are notifying a
 * peer because of changes to a DB that the app has subsequently deleted then
 * we don't know to stop trying to notify the peer. None of our current
 * scenarios require that we track the DB along with peer so for now we are
 * going to stay simple until somebody shows up with a compelling scenario that
 * is actually going to be implemented.
 *
 * @param {string[]} entries
 * @returns {Promise<?error>} Returns null if everything went fine otherwise
 * returns an error object.
 */
_PeerNotificationListHandler.prototype.changeEntries = function(entries) {
  return new Promise();
};

/**
 * Takes the current state of the notification list and outputs it to the
 * thaliNotificationServer.
 *
 * If the number of entries in the list exceeds
 * {@link module:thaliSendNotificationBasedOnReplication~MAXIMUM_NUMBER_OF_PEERS_TO_NOTIFY}
 * then we MUST only emit the maximum allowed number of peers by taking the
 * maximum limit of peers starting at the top of the list.
 *
 * @param {module:thaliNotificationServer~ThaliNotificationServer} thaliNotificationServer
 * @returns {Promise|exports|module.exports}
 */
_PeerNotificationListHandler.prototype.outputToNotificationServer =
  function(thaliNotificationServer) {
    return new Promise();
  };

/**
 * We will only update the notification beacons every X milliseconds while the
 * app is in the foreground where X is defined below.
 *
 * @private
 * @type {number}
 */
var UPDATE_WINDOWS_FOREGROUND = 1000;

/**
 * We will only update the notification beacons every X milliseconds while the
 * app is in the background where X is defined below.
 *
 * @private
 * @type {number}
 */
var UPDATE_WINDOWS_BACKGROUND = 250;

/**
 * We MUST NOT submit more than this number of peers to the
 * {@link module:thaliNotificationServer~ThaliNotificationServer}.
 * @public
 * @type {number}
 */
var MAXIMUM_NUMBER_OF_PEERS_TO_NOTIFY = 10;


/**
 * We monitor the PouchDB database's change feed and when we receive a change
 * we have to know who to tell about it. We don't want to notify the person
 * who caused the change but we don't know who that is. So we use this callback
 * to let the programmer tell us who should we notify about this change.
 *
 * We supply to the callback, in addition to the change, a complete list of
 * all the peers we currently plan on notifying based on all the databases
 * we are tracking. This function then returns a complete list of who we
 * should notify, in priority order. Note that the returned list has to cover
 * all databases. In practice this means that most filters should only add
 * names and maybe change order but not remove names. An obvious exception
 * to the remove name rule would be if a name is on a prohibited list.
 *
 * @callback ChangesFilter
 * @param {info} change This is the change object given to use by PouchDB
 * @param {string[]} currentChangeList List of peers we are currently planning
 * on notifying of changes.
 * @returns {string[]} This is an array of strings holding
 * base64 url safe encoded ECDH public keys that we will notify about changes.
 */

/**
 * @classdesc This class handles determining who to notify about changes to
 * local
 * databases. In the simplest case we just monitor changes to the databases
 * we are told to watch and use that to create a list of peers to notify. In
 * practice however, things are a bit more complex.
 *
 * When we are told to notify a peer of a change we have to remember the need
 * to notify that peer even across reboots of the app. Otherwise if the app
 * stops and restarts we won't know who we were supposed to notify and there
 * is no new data coming in that will tell us. Eventually, btw, we will get
 * more sophisticated about this and actually be able to look at which peers
 * have records waiting for them in which DBs and then be able to check the last
 * record the peer sync'd to. But not today. Or tomorrow. Or next week... or.
 * In any case, since we aren't fancy, our solution is that we will
 * create our own PouchDB database and store the list of peers we are notifying
 * there. That way if we are restarted we will remember who we need to notify.
 *
 * We also have to listen for
 * {@link module:thaliACLEnforcer.event:peerAuthenticated} events from the ACL
 * infrastructure to notify us when a peer has authenticated to us. The first
 * time this happens during a change window we will remove the peer from the
 * change list. However if the peer is added back to the change list during
 * the same change window then a further event will NOT cause us to remove
 * them from the list because this could cause a race condition where they
 * have already retrieved their list of changes, this new change isn't on the
 * list and we won't notify the peer about the new change since we saw
 * a connection from them.
 *
 * BUGBUG: We still have a bug. It's perfectly possible that a peer could get
 * its changes list before a window and then start making further connections
 * into the next window. If there is just one record changed during the next
 * window then that change notification will get swallowed. Eventually we really
 * need to track the sync change records so we know exactly where the peer has
 * sync'd up to. But not today.
 *
 * BUGBUG: Although this is a 'new' able class in reality it is only intended
 * to be used as a singleton. There must not be more than one instance of this
 * class in the same app or errors will occur. We absolutely can fix that
 * if someone has a killer scenario they are shipping that needs this fixed.
 *
 * @param {module:thaliNotificationServer~ThaliNotificationServer} thaliNotificationServer
 * This is the server we will use to push out notifications.
 * @param {module:thaliACLEnforcer~ThaliAclEnforcer} thaliAclEnforcer
 * @param {PouchDB} pouchDBInstance We will use this to create instances of
 * PouchDB and register for changes on them.
 * @constructor
 */
function ThaliSendNotificationBasedOnReplication(
  thaliNotificationServer,
  thaliAclEnforcer,
  pouchDBInstance) {

}

/**
 * @classdesc This is an interface for handling the cancel method on a
 * registered filter.
 *
 * @name CancelFilter
 * @class
 */

/**
 * This method cancels the associated filter. This method MUST be idempotent
 * so it can be safely called multiple times.
 *
 * @method module:thaliSendNotificationBasedOnReplication~CancelFilter#cancel
 */

/**
 * This method causes us to monitor the named database and call the filter
 * every time there is an update.
 *
 * It is allowed to call this method multiple times with the same dbName. But
 * we do not check if the same filter has been used before. Instead we will
 * just register the filter over and over again.
 *
 * When we get a call the first thing we will do is create an instance of
 * the database using the submitted PouchDB object and then call the Changes
 * function and register ourselves as a listener. We will register as a live
 * listener, we will include_docs including conflicts and attachments. We must
 * set return_docs to false to keep from blowing memory.
 *
 * @param {string} dbName This is the string that will be passed to the PouchDB
 * instance. The resulting database will then be monitored for changes.
 * @param {ChangesFilter} changesFilter
 * @returns {module:thaliSendNotificationBasedOnReplication~CancelFilter} Used
 * to cancel the monitoring associate with this call.
 */
ThaliSendNotificationBasedOnReplication.prototype.addFilter =
  function(dbName, changesFilter) {

  };

module.exports = ThaliSendNotificationBasedOnReplication;
