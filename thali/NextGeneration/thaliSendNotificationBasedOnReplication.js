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
 * BugBug: In the interests of getting out the door fast we are going to focus
 * on just managing a single DB's notifications. But this is obviously broken,
 * we should support tracking multiple DBs.
 *
 * @private
 * @param {PouchDB} pouchDB
 * @constructor
 */
function _PeerNotificationListHandler(pouchDB) {

}

/**
 * The name of the database we will use to track the current peer notification
 * list. We have to use our own database as opposed to just some record in the
 * database we are tracking because this information is secret and the farther
 * we can keep it from a database that is available on the wire the better.
 * @private
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
 * @private
 * @param {string[]} entries
 * @returns {Promise<?Error>} Returns null if everything went fine otherwise
 * returns an error object.
 */
_PeerNotificationListHandler.prototype.changeEntries = function(entries) {
  return new Promise();
};

/**
 * Every standard interval we will check to see if one of two possible
 * situations exist:
 *
 * Beacons have expired - When we publish beacons we do so with an expiration
 * date. If that date has been reached then we have to generate the entire
 * beacon string afresh.
 *
 * Beacons have changed - Once the advertising interval has been reached we will
 * check the list of peers we have been told to track. We will then look up
 * their _Local docs to find their sequence numbers and compare them to our
 * current sequence number. Any whose number is less need to be notified. We
 * will then take, in order, however many entries are less than the maximum
 * number of notifications we have been given and we will call the notification
 * server with a beacon string to advertise. If there are no beacons to
 * advertise then we will submit an empty list.
 *
 * Although unlikely it is theoretically possible for processing the list to
 * take long enough that we bump into the next interval. In that case we
 * MUST finish the current interval and skip the intervals we 'ran over' into.
 *
 * @private
 * @param {module:thaliNotificationServer~ThaliNotificationServer} thaliNotificationServer
 * @returns {Promise<?Error>}
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
 * @private
 * @type {number}
 */
var MAXIMUM_NUMBER_OF_PEERS_TO_NOTIFY = 10;


/**
 * We monitor the PouchDB database's change feed and when we receive a change
 * we have to know who to tell about it. We don't want to notify the person
 * who caused the change but we don't know who that is. So we use this callback
 * to let the programmer tell us who should we notify about this change.
 *
 * We supply to the callback, in addition to the change, a complete list of all
 * the peers we currently plan on notifying. This function then returns a
 * complete list of who we should notify, in priority order. In practice this
 * means that most filters should only add names and maybe change order but not
 * remove names. An obvious exception to the remove name rule would be if a name
 * is on a prohibited list.
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
 * a local database. In the simplest case we just monitor changes to the
 * database we are told to watch and use that to create a list of peers to
 * notify. In practice however, things are a bit more complex.
 *
 * When we are told to notify a peer of a change we have to remember the need to
 * notify that peer even across reboots of the app. Otherwise if the app stops
 * and restarts we won't know who we were supposed to notify and there is no new
 * data coming in that will tell us. For each peer we care about we will track
 * what is the last sequence number they have synch'd up to. We can find this
 * information by retrieving the `_Local/<peer ID>` record for that peer. If
 * it doesn't exist then we treat their last sync'd sequence number as 0
 * otherwise we use the value there. We can get the current sequence number
 * for the database from the PouchDB info() function in the update_seq field.
 * Now we just compare the number in the _Local record against the current
 * sequence number and we know who we need to notify.
 *
 * BUGBUG: Although this is a 'new' able class in reality it is only intended to
 * be used as a singleton. There must not be more than one instance of this
 * class in the same app or errors will occur. We absolutely can fix that if
 * someone has a killer scenario they are shipping that needs this fixed.
 *
 * @param {module:thaliNotificationServer~ThaliNotificationServer} thaliNotificationServer
 * This is the server we will use to push out notifications.
 * @param {PouchDB} pouchDB database we are tracking changes on.
 * @constructor
 */
function ThaliSendNotificationBasedOnReplication(
  thaliNotificationServer,
  pouchDB) {

}

module.exports = ThaliSendNotificationBasedOnReplication;
