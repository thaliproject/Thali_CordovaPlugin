'use strict';

/** @module thaliACLLayer */

/**
 * @classdesc We need to prevent callers from accessing content they do not
 * have a right to.
 *
 * ## Requirements
 *
 * We need to secure access to our Express-PouchDB instance via 'the wire'.
 * We have three specific kind of roles we need to enforce:
 *
 * Admin Role - Anyone in this role can do anything they want. We only have
 * this role for the Cordova webview when it talks to Express-PouchDB.
 *
 * Pull Replication Role - This is for authenticated remote users. Remember that
 * we get authentication via TLS not HTTP. So we have to expose the user's
 * authenticated identity from the TLS layer and then only let them access
 * methods and paths needed for Pull Replication. We also need to let them
 * access `_Local/<publicKeyHash>` for their public key hash. We have to
 * enforce that no one else can get to that particular document if they aren't
 * authenticated with the matching hash.
 *
 * Anonymous Role - This is for anyone who isn't authenticated. They can only
 * access the beacon endpoint which isn't even part of the paths owned by
 * Express-PouchDB so we don't need to do anything here.
 *
 * ## Existing Solutions
 *
 * [Here](https://git.launchpad.net/python-pouchdb/tree/docs/js-plugins.rst) are
 * a bunch of extensions to PouchDB that we probably could get, with some
 * additional logic, to do what we want. But, for example, [pouchdb-auth](
 * https://www.npmjs.org/package/pouchdb-auth) depends on a name/password
 * database. All of which could probably be eventually fixed but there is so
 * much machinery here making so may assumptions that aren't consistent with
 * what we are doing with TLS PSK connections. Also they want to enforce
 * security at the PouchDB API level not the Express-PouchDB level.
 *
 * There is also [CoverCouch](https://github.com/ermouth/covercouch) which
 * implements per document ACLs. That is something we might eventually need
 * but the implementation is specific to CouchDB not Express-PouchDB.
 *
 * ## Proposed Solution
 *
 * The most straight forward approach would appear to create an Express router
 * that is registered before Express-PouchDB so that we can get to all the
 * requests before Express-PouchDB does.
 *
 * ### Admin Role
 *
 * For this role we would pass in some pre-configured secret on all requests. We
 * can use ajax.headers as an option when we create a PouchDB client in places
 * like the replication logic to pass in a header with that secret that the
 * server can then validate. The obvious candidate here would be some custom
 * extension of the HTTP Authorization header.
 *
 * Our over all logic would be that if we get a connection in the clear (no
 * TLS) and if it doesn't come from 127.0.0.1 then we immediately reject.
 *
 * If it does come from 127.0.0.1 then we would validate that it had the
 * authorization header with the right secret. We don't need to encode the
 * secret because it will only go over localhost and so can't be intercepted
 * by outsiders. There is still an attack here by a hostile app running on the
 * device. See [here](http://thaliproject.org/SecuringCordovaAndNodeJs/) for an
 * indepth examination of the security issues and how we eventually want to
 * deal with them.
 *
 * If all the previous checks are good then we allow anything.
 *
 * ### Thali_Pull_Replication Role
 *
 * In this role the user connected over TLS using a PSK that we can associate
 * with a an identity (this is generated as part of beacon generation). We would
 * then surface the public key for the identity to the router who would check
 * that the path for the request is from our white list. The white list will
 * contain Express-Pouch DB paths and methods that the caller can get to. These
 * will include paths/methods needed for pull replication as well as the ability
 * to get to _Local. We will have special security for
 * `_Local/id_[PublicKeyHash]` to make sure that only someone authenticated with
 * the PublicKeyHash is allowed to make requests for that document.
 *
 * ### Unauthenticated
 *
 * When folks want to access the beacon they need to connect via TLS with a
 * predefined PSK. So we need to check for the magic PSK and if used then the
 * caller will only be allowed to make a GET request to the beacon path and
 * nothing else.
 *
 * ## Endpoint security for Thali_Pull_Replication
 *
 * Below is a list of all the endpoints we know of in Express-PouchDB. The idea
 * is to identify for each and everyone which we need to allow for
 * Thali_Pull_Replication to work. We also identify what PouchDB APIs are
 * associated with that path.
 *
 * The following are paths/methods we need to support
 *
 * | Path | Method | PouchDB API |
 * |------|--------|-------------|
 * | /db/_all_docs | GET, HEAD, POST [1] | allDocs |
 * | /db/id/attachment | GET | get & getAttachment |
 * | /db/_bulk_get | POST | bulkGet |
 * | /db/_changes | GET, POST [2] | changes |
 * | /db | GET | info |
 * | /db/id | GET | get |
 *
 * [1] POST on _all_docs provides config options that wouldn't fit into a
 * query URL. But can we be sure that all of those options won't cause a problem
 * on the DB? E.g. a denial of service attack?
 *
 * [2] POST on _changes is used to support long polling and continuous changes.
 * The only threat here would appear to be a denial of service attack.
 *
 * The following are paths/methods we need to ban
 *
 * | Path | Method | PouchDB API |
 * |------|--------|-------------||
 * | _all_dbs | GET | allDbs |
 * | /db/_design/id/attachment | GET | get & getAttachment |
 * | /db/_design/id/attachment | DELETE | removeAttachment |
 * | /db/id/attachment | DELETE | removeAttachment |
 * | /db/_bulk_docs | POST | bulkDocs |
 * | /db/compact | POST | compact |
 * | /_config* | * | NA |
 * | /db | PUT | new |
 * | /db | DELETE | destroy |
 * | /db/_ensure_full_commit | POST | NOOP |
 * | /[auth db]/id | GET | get |
 * | /db/id | POST | put |
 * | /db/id | PUT | put |
 * | /db/id | DELETE | remove |
 * | /db/id | COPY | get + put |
 *
 * STOPPED AT FIND.JS
 *
 * The following Express-PouchDB Paths are NOOPs, they are usually there to
 * make Fauxton happy. But for security reasons we need to exclude all of them.
 * This will surely irritate our developers because they will want to be able to
 * use Fauxton for some quick debugging so eventually we will need some kind of
 * debugging mode:
 *
 * - active-tasks
 * - cluster-rewrite
 * - cluster
 * - db-updates
 * - ddoc-info
 * - fauxton
 * - find
 *
 *
 *
 * The NAs mean that the path is not defined on the PouchDB object at all but
 * rather is something handled by Express-PouchDB.
 *
 * The NOOPs mean that Express-PouchDB has a path for it but it doesn't do
 * anything yet.
 *
 * /_config*
 * /_log
 * /_active_tasks
 * /_db_updates
 * /_restart
 *
 *
 * @public
 * @constructor
 */
function ThaliACLLayer() {

}
