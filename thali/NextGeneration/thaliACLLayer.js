'use strict';

/** @module thaliACLLayer */

/**
 * @classdesc This class defines two different sets of behaviors. One is is
 * defines the API that our TLS layer will call to validate PSK requests and
 * determine if the specified identity is authorized and if so what secret
 * it has to present. Separately it will check every individual HTTP request
 * to make sure that the requester is still authorized and that the request
 * they are making is something they are allowed to do.
 *
 * ## Requirements
 *
 * We need to secure access to our Express-PouchDB instance via 'the wire' (i.e.
 * via radios). We have three specific kind of roles we need to enforce:
 *
 * Admin Role - Anyone in this role can do anything they want. We only have
 * this role for the Cordova webview when it talks to Express-PouchDB.
 *
 * Pull Replication Role - This is for authenticated remote users. Remember that
 * we get authentication via TLS not HTTP. So we have to expose the user's
 * authenticated identity from the TLS layer and then only let them access
 * methods and paths needed for Pull Replication.
 *
 * Anonymous Role - This is for anyone who isn't authenticated. They will use
 * the magic PSK value discussed below and it will only allow them to get to
 * the beacon endpoint.
 *
 * ## Existing Solutions
 *
 * [Here](https://git.launchpad.net/python-pouchdb/tree/docs/js-plugins.rst) are
 * a bunch of extensions to PouchDB that we probably could get, with some
 * additional logic, to do what we want. But, for example, [pouchdb-auth](
 * https://www.npmjs.org/package/pouchdb-auth) depends on a name/password
 * database. All of which could probably be eventually fixed but there is so
 * much machinery here making so may assumptions that aren't consistent with
 * what we are doing with TLS PSK connections. More fundamentally in many
 * cases the security enforcement is not done at the Express layer but rather
 * is enforce using wrappers around the PouchDB object itself. For now we want
 * to take a conservative approach and enforce security at the higher level
 * of Express and not let a request anywhere near PouchDB unless we know it
 * is o.k. But eventually we should have two layers of protection. One at
 * Express and a second wrapping PouchDB th way pouchdb-security does.
 *
 * There is also [CoverCouch](https://github.com/ermouth/covercouch) which
 * implements per document ACLs. That is something we might eventually need
 * but the implementation is specific to CouchDB not Express-PouchDB so we are
 * going to stay simple for now.
 *
 * ## Proposed Solution
 *
 * The most straight forward approach would appear to create an Express router
 * that is registered before all our other endpoints so that we can get to all
 * the requests before everyone else does.
 *
 * ### Admin Role
 *
 * We will use the HTTP authorization header with the security type 'CLEAR'
 * followed by a space followed by the secret. Since this is only sent over
 * localhost it cannot be intercepted. This is still not a fully secure
 * solution as obviously an attacker running an app on the phone could have
 * done a port hijack and fool the WebView into connected to the hijacked port.
 * So eventually we do need to implement a way to prevent hijack attacks.
 * See [here](http://thaliproject.org/SecuringCordovaAndNodeJs/) for details.
 *
 * But for now, authorization: CLEAR foobarblah will do just fine.
 *
 * ### Thali_Pull_Replication Role
 *
 * In this role the user connected over TLS using a PSK that we can associate
 * with an identity (this is generated as part of beacon generation). We would
 * then surface the public key for the identity to the router who would check
 * that the path for the request is from our white list. The white list will
 * contain Express-Pouch DB paths and methods that the caller can get to. These
 * will include paths/methods needed for pull replication as well as the ability
 * to get to _Local.
 *
 * ### Unauthenticated
 *
 * When folks want to access the beacon they need to connect via TLS with a
 * predefined PSK. So we need to check for the magic PSK and if used then the
 * caller will only be allowed to make a GET request to the beacon path and
 * nothing else.
 *
 * The current magic PSK identity value is "beacons" and the secret is a binary
 * array consisting of 16 zero bytes in a row.
 *
 * ## Endpoints needed for Thali_Pull_Replication
 *
 * Below is a list of all the endpoints we know of in Express-PouchDB. The idea
 * is to identify for each and everyone which we need to allow for
 * Thali_Pull_Replication to work. We also identify what PouchDB APIs are
 * associated with that path but this is just for Yaron, everyone else should
 * ignore that column.
 *
 * | Path | Method | PouchDB API |
 * |------|--------|-------------|
 * | / | GET | NA [3] |
 * | /:db | GET | info |
 * | /:db/_all_docs | GET, HEAD, POST [1] | allDocs |
 * | /:db/_bulk_get | POST | bulkGet |
 * | /:db/_changes | GET, POST [2] | changes |
 * | /:db/_local/thali_:id | GET, PUT, DELETE | get, put, remove |
 * | /:db/_local/:id |
 * | /:db/_revs_diff | POST | revsDiff |
 * | /:db/:id | GET | get |
 * | /:db/:id/attachment | GET | get & getAttachment |
 *
 * :db - Substitute with the name of the DB we are protecting.
 * :id - Substitute with the ID of a document as requested over the wire.
 * thali_:id - Is an ID that begins with the prefix thali_ and otherwise
 * is just an ID.
 *
 * [1] POST on _all_docs provides config options that wouldn't fit into a
 * query URL. But can we be sure that all of those options won't cause a problem
 * on the DB? E.g. a denial of service attack?
 *
 * [2] POST on _changes is used to support long polling and continuous changes.
 * The view query parameter is worrisome since it allows calling predefined
 * view functions on the DB. I don't think PouchDB has any but we really should
 * fail any requests that include this query option.
 *
 * [3] The GET on the root just returns information about the server, not any
 * particular DB. The values are generated by the Express code, the PouchDB
 * object is not touched. I'm not sure this is really required for replication.
 * We should check. If not we should remove it from the approved list.
 *
 * I would have expected that _missing_revs would be something we needed to
 * support but I can't find it implemented in Express-PouchDB so I guess not.
 *
 * ## Enforcing endpoint security
 *
 * For now we enforce endpoint security in Express based. Eventually we should
 * use the tools in PouchDB to also secure the API calls on the PouchDB object
 * as a second layer of defense. But not today.
 *
 * We start by creating an Express Router using app.all('*', function(req, res,
 * next) ...). This makes sure that everything has to go through us first. There
 * is also an explicit assumption here that when a router object is created it
 * is first passed to this object before any other object so we can be sure we
 * are first in line to process all incoming requests.
 *
 * If req.connection.pskIdentity is null/undefined then we MUST:
 * - check req.ip to make sure that the IP address is set to
 * "127.0.0.1"
 * - make a case sensitive string compare and make sure that
 * the value of the authorization header after the "CLEAR" keyword matches
 * the value set in this object.
 * If both checks pass then we MUST call next(). Otherwise we MUST immediately
 * return a 401 Unauthorized and close the connection as defined below. For now
 * we won't worry about also returning a www-authenticate header.
 *
 * If req.connection.pskIdentity is not null/undefined then we are dealing with
 * a PSK connection.
 *
 * If the pskIdentity is the magic beacons value (defined above) then the
 * request.method MUST be "GET" (we don't even support HEAD) and the
 * req.originalUrl (to make sure we don't get confused by our own rewriting)
 * MUST be "/NotificationBeacons" in a case sensitive compare. The full
 * request-URI MUST fully match, that is, there can be no query or anchor
 * element. If the magic beacons value is being used but the method and path
 * aren't exactly as specified then the request MUST be rejected with a 401
 * Unauthorized and the connection closed as given below. If the check passes
 * then next() MUST be called.
 *
 * __BUGBUG:__ Is req.originalUrl the full original URL, would it have included
 * any query or anchor elements?
 *
 * If the pskIdentity is not the magic beacons value then we are dealing with an
 * authenticated caller. There are some race conditions where it is
 * theoretically possible for someone to keep a TLS connection open forever and
 * to lose authentication rights while the connection is still open. To protect
 * against that we check the pskIdentity against the pskMap on each request. If
 * the identity is no longer in the map then we return 401 and close the
 * connection as defined below.
 *
 * Now the hard part of dealing with a non-magic beacon pskIdentity is that
 * we have to restrict (HARD) what they can do. There is a table above that
 * we have to use to decide what path + what method the caller is allowed to
 * request. For now we will ignore query arguments since most of those commands
 * take query arguments and they are largely harmless. But if a request doesn't
 * exactly match one of those paths with the associated method then the request
 * MUST be rejected with a 401 Unauthorized. In matching a path we have to
 * split the URL based on "/" and treat each segment separately. For :DB we
 * substitute that with the dbName argument below. For :id you have to accept
 * anything that does not start with '_'. This is tricky because, for example,
 * you have to tell that /foo/bar is a request for the document with the :id
 * bar on the DB foo. While /foo/_local/blah is a request for a special
 * sub-area called _local (see that leading _, that is reserved) for a document
 * there with the id blah. The point is that when trying to figure out if
 * we are dealing with a reserved path or with an :id the way to tell is if
 * it starts with _. If it does start with _ then it has to be for a keyword
 * that is listed in the table above or the request MUST be rejected. And keep
 * in mind that segments have to match exactly. So /foo/_changes with a GET
 * method is fine but /foo/_changes/blah is not since the path in the table only
 * contains two segments, not three. If the request matches the table then
 * next() MUST be called otherwise a 401 Unauthorized MUST be returned.
 *
 * ## Closing a connection
 *
 * In some cases, identified above, we want to close the TCP connection. This is
 * not always the case. Some failures don't require this. So please pay attention
 * to the text above. But where we do want to close a connection then in theory
 * the friendliest way to do it is to set res.set('Connection','close');. But
 * I'm not 100% sure this actually forces the connection to close. We need to
 * run some experiments to be sure that this at least closes the connection on
 * the server side. Otherwise we will have to call res.end (or res.send or
 * res.json depending on the scenario) and then try request.connection.destroy.
 * I'm not 100% sure request.connection.destroy actually works right. It might
 * not work at all or it might kill the connection without letting the final
 * response go through which would be bad. We need to experiment to find out.
 *
 * __BUGBUG:__ In theory what we really should do in the case of a non-TCP
 * connection is we should close the native connection at the MUX layer. But
 * let's see if a single connection close works first.
 *
 * @public
 * @param {Object} router The router we will immediately add our security logic
 * to.
 * @param {string} dbName This is the path segment name that we will use in
 * the request URL to identify the DB.
 * @constructor
 */
function ThaliACLLayer(router, dbName) {

}

/**
 * There are plenty of fun face conditions where we think a remote peer is
 * fully sync'd and so we remove them from our beacon list only to find out
 * they aren't. To make the system a bit more robust once a beacon is advertised
 * we will continue to allow requests from it up to X minutes after it is
 * removed from our list.
 *
 * @type {number}
 */
ThaliACLLayer.keepOldPskMapValuesInMilliseconds = 10 * 60 * 1000;

/**
 * Returns the admin secret that was set when this object was initialized. The
 * admin secret must be a cryptograhpically secure randomly generated string.
 * The most straight forward way to generate this is to use crypto.randomBytes
 * to generate say a 16 byte array and then base 64 URL safe encode the
 * result and use that as the secret.
 *
 * @public
 * @return {string}
 */
ThaliACLLayer.prototype.getAdminSecret = function() {
  return 'abc';
};

/**
 * Updates the map of identities/secrets. This map will be used to determine
 * what connections to accept via a TLS PSK connection.
 *
 * If an identity that is currently in the map is not in the map passed in on
 * the update than that identity needs to be expired out of the map after
 * {module:thaliACLLayer~ThaliACLLayer.keepOldPskMapValuesInMilliseconds}.
 *
 * Note that the magic beacon value will never be submitted via this API.
 *
 * @public
 * @param {Object.<string, buffer>} pskMap The string is a client PSK identity
 * and the buffer is the associated secret.
 */
ThaliACLLayer.prototype.updatePskMap = function(pskMap) {

};

/**
 * This function is intended to be used by the TLS validation layer. The
 * identity is passed in and the response is null if the identity is not
 * recognized or a buffer containing the secret if the identity is recognized.
 * This function is driven by a combination of the default magic value for
 * beacons and whatever the latest call to
 * {module:thaliACLLayer~ThaliACLLayer.setPskMap} contained.
 *
 * Keep in mind that this API will be called by the TLS server. Separately
 * from that will be the actual HTTP request that is enabled by passing this
 * check and which then involves all the app.all stuff defined above.
 *
 * @public
 * @param {string} pskIdentity
 */
ThaliACLLayer.prototype.validatePskIdentity = function(pskIdentity) {

};

module.exports = ThaliACLLayer;
