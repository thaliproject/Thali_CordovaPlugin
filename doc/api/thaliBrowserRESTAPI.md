# Thali Browser REST API

This file defines a REST API that Cordova WebViews can use to work with the Thali Cordova Plugin backend.

We use a REST API vs the Cordova Bridge because in most cases WebViews want to talk to the Thali backend using
AJAX as it is vastly more efficient in terms of processing. For example, moving an attachment over the Cordova
bridge would involve turning the entire attachment into an in-memory string. 
 
Current Thali's node.js server runs on the port 5000. In the future this will change and a random port will instead 
be used. This random port will be discoverable through a Javascript API that uses the Cordova/JXcore bridge. But
for now we will just use port 5000.

# REST Front End

## Error Handling
If a request should fail for any reason then the response body will be of content-type application/json and
the body content will be:

``` Javascript
{
   "errorCode": "A pre-defined string"
   "errorDescription": "some potentially long string"
}
```

The following is a table of error codes that are re-used across different endpoints.

errorCode | Meaning
----------|--------
timedOut  | The server side code involved an asynchronous request that did not return in time to fulfill the user's request
internalError | Something that really should not have happened, happened

## GET /webview/DeviceIdentity
Purpose: Get a string that represents a hash of the device's current user's personal public key. This hash is used 
as a short handle to point to the user and so allows the app to figure out which records are from or about the user. 
It's also used in generating doc IDs in order to match them to the user.
Response Content-Type: application/json
Response Body:
 
```Javascript
{
  "publicKeyHash": "big ugly string"
}
```

Implementation: This calls the getDeviceIdentity method on the ThaliReplicationManager. The REST API is assumed
to have access to the replication manager object since eventually the API will be expanded to allow controlling
it. Note that we are explicitly holding open the connection until we get the callback from getDeviceIdentity. It is
theoretically possible for the callback to take too long to return and for the server side request to time out.
Therefore we need node side code to detect this scenario and return a 400 with a timedOut errorCode. We also need
to make sure that when the callback to getDeviceIdentity does return that we know that the response object is no
longer available (e.g. check response.finished) and so don't do anything.

Tests: 

* Issue a GET against the live system with a successful response from getDeviceIdentity and confirm we get back the
right value in the REST response.
* Use a mock layer to issue a GET and get an error back from getDeviceIdentity and make sure we properly return the
internalError code along with the message from the error object in the REST response.
* Use a mock layer to issue a GET request and make sure getDeviceIdentity takes too long to respond (we can shorten
the time period until the timeout via server.setTimeout) and that we properly return a timedOut error and that
the cb handler doesn't try to call the response object a second time (since it should have been finished thanks
to sending the timedOut error), we can use response.finished to check.

## PUT /webview/IdentityExchange
Purpose: Instructs the Thali backend to begin the process of finding peers to perform an identity exchange 
using the listed friendly name which MUST be a string that is at least one character long. If the response can be 
successfully carried out then a 201 created will be returned with no response body. There should only be a single
request to IdentityExchange (for PUT or DELETE) outstanding at at time. Multiple requests will be serialized in
a random order and are quite likely to time out. Note that if a request fails with a timedOut error it is still
possible that the request was successful. The easiest way to handle this is to just repeat the same request since
PUTs are idempotent.

Request Content-Type: application/json
Request Body:

```Javascript
{
   "peerFriendlyName": "Matt"
}
```

Implementation: If there has been no successful call to startIdentityExchange() then this method just calls it and
when the callback is called back if it's an error then we return internalError otherwise we return a 201 created.
If there has been a successful call and it used the same name as the current PUT request then we return 201 created.
If the previous call was a failure then we process this call as normal. If there has been a successful call to
PUT IdentityExchange (without an intervening DELETE) but with a different name than the current PUT then we have
to call stopIdentityExchange followed by startIdentityExchange.

Note that all the usual timeout issues apply.

There is a potential for a nasty race condition between PUT IdentityExchange and DELETE IdentityExchange or even
two PUT IdentityExchange requests done in a row with different names. This could easily result in us doing
overlapping calls to startIdentityExchange and stopIdentityExchange. In general this shouldn't happen since the
caller should only have one outstanding request at a time but the reality is that it can happen. So simplify things
we should create a single global level promise. Whenever a request is received for IdentityExchange we should
stick the request handler onto that promise. The code to process the request will only be run once it is reached
in the promise chain. This effectively serializes all the requests and prevents race conditions. It's not great
for perf but who cares? Nobody should be calling these methods in parallel anyways. Also note that depending
on how slow the system is running multiple requests could result in time outs for later request thus giving us
a timedOut error.

Tests:

* A PUT when we aren't doing an identity exchange and it works
* A successfully PUT followed by a second PUT with the same name, make sure we do nothing.
* A PUT when we are doing an identity exchange but with a different name than the one submitted, make sure we
stop and start
* A PUT where the call to startIdentityExchange takes too long to respond and we have to return a timedOut error
 * In one version startIdentityExchange should return success and we should confirm that our state manager 
registered this even though the response object timed out with an error.
 * In other version startIdentityExchange should return with a failure and we should confirm that the state manager
correctly recorded that we don't have an active identity exchange even though the response object already returned 
with an error.
* A variant on the above where we have a successful PUT followed by a second PUT with a second name and the call
to stopIdentityExchange takes too long and causes a timedOut error Code.
 * In one version have stopIdentityExchange be successful and make sure the handler records things properly
 * In another version have stopIdentityExchange fail and make sure the handler records things properly
* A PUT where we are in the middle of one PUT and are now getting a second PUT followed by a DELETE to make sure 
they are serialized.

## DELETE /webview/IdentityExchange
Purpose: Instructs the Thali backend to stop the identity exchange process. If the request is successful then a
204 No Content should be returned.

Implementation: If identity exchange is not currently active (something the REST layer will have to track) then
a 404 should just be returned. If there is an active startIdentityExchange then we have to call stopIdentityExchange.
Note that the same time out issues as discussed in previous APIs apply here and must be handled similarly. Also
note the race condition issues mentioned previously. They apply as well. The use of the global promise will handle
those race conditions. Note that one should always stick all PUT and DELETE requests to IdentityExchange onto the
global promise. If there is no outstanding promise that we are waiting to return then the request will be processed
more or less instantly.

Tests:
* A DELETE when we aren't doing an identity exchange, make sure we return 404
* A DELETE where we are doing an identity exchange, make sure we stop and then do a second DELETE to make sure
we return a 404
* A DELETE with a mock that causes stopIdentityExchange to return an error, make sure we properly return the
internalError code and message. Also make sure we properly mark status as not being in an identity exchange
* A DELETE with a mock that causes the delete to timeout and return a timedOut error
 * One version should have the DELETE succeed and the handler needs to record the fact that we aren't in an 
identity exchange
 * Another version in which the DELETE fails, this should also result in recording the fact that we aren't in an 
identity exchange
* A DELETE followed immediately by a PUT and another DELETE, show that they are properly serialized

## GET /webview/IdentityExchange
Purpose: Gets the current state of identity exchange. If there is no active identity exchange (e.g. PUT wasn't
successfully called on IdentityExchange) than a 404 Not Found response with a noIdentityExchangeActive error code will
be returned. If there is an active identity exchange then the response will include the friendly name being used
as well as a list of peers who are currently advertising their availability to do an identity exchange. Note that
if a peer is returned in one GET request and then subsequently disappears before the next GET request then it will
be omitted from the next GET request. A 200 O.K. response will provide three pieces of information for any peers
who are advertising their availability for identity exchange. First, it will return their public key hash. This is
used to tell if the peer is already known, in which case there is no need to do an identity exchange with them. The
second is the peer device ID. This is a handle to the device used by the peer. Note that it is perfectly possible
for a peer to have multiple devices (say a phone and a laptop) so it's possible to see multiple peers entries
with the same public key hash but they should have different device IDs. Last is a friendly name intended for
display. Entries with the same peer public key hash can still have different friendly names, for example 
"David's phone" and "David's laptop". Under attack conditions one can get unpleasant situations such as multiple
devices advertising the same device ID and friendly name but different public key hashes. This cannot cause a failure
in the identity exchange algorithm (the code comparison step protects the user) but it can cause a bad user experience.
Of course getting attacked generally does result in sub-optimal user experiences.

Response Content-Type: application/json
Response Body:

``` Javascript
{
 "peerFriendlyName": "Matt",
 "peers":
 [
  {
    "peerPublicKeyHash": "some ugly string",
    "peerDeviceId": "another ugly string",
    "peerFriendlyName": "David"
  },
  {
    "peerPublicKeyHash": "another really ugly string",
    "peerDeviceId": "another super ugly string"
    "peerFriendlyName": "Toby"
  }
 ]
}
```

Implementation: The peerFriendlyName is simply just the stored state from the handler who processed the
startIdentityExchange request, so no magic there. The contents of the peers object is just the current summary
of values from the peerIdentityExchange event from the ThaliReplicationManager. The only trick is that the
peerIdentityExchange event contains peerAvailable. When set to false that just means we should remove that entry
for the list we will return in response to this request. Otherwise peerName maps to peerPublicKeyHash,
peerIdentifier maps to peerDeviceId and peerFriendlyName maps to the same name here. Note that if we have two
devices who both advertise the exact same peerIdentifier then we have an attack situation and we should ignore
all entries with that peerIdentifier. This all assumes that an identity exchange is underway. 
If startIdentityExchange hasn't been successfully called then this method just returns 404.

Tests:
* A GET without an identity exchange to make sure we return 404
* Mock up the peerIdentityExchange event to add and remove various peers and then do GET requests to make sure we
return the right peer state and check that we have the right root peer friendly name.
* Mock up the peerIdentityExchange event and make sure we properly ignore entries with the same peerIdentifier and
make sure we ignore all of them.

## PUT /webview/IdentityExchange/ExecuteExchange
Purpose: To attempt to exchange identities with the identified device. If there has been no successful PUT to 
IdentityExchange then this method will fail with a 404 Not Found. Because identity exchanges can take an unbounded
time this method will generally just return 202 Accepted with no content body. To find out if the identity exchange
has occurred one must POLL a GET on IdentityExchange/ExecuteExchange. Note that since PUT is idempotent is it is
fine to issue multiple PUT requests with the same value. This will not affect the identity exchange process. However
if a PUT with a different peerDeviceID is submitted than the currently active ID then the current exchange will
be stopped and a new one started. In theory if a PUT request is made for an existing name then we could return the
status right away but that is rare and it's not worth complicating our code or the caller's code to handle it. The
caller should just assume they have to call GET to get the result. Note that once an ExecuteExchange is created it
will stay active until either a PUT with a different name is called or DELETE is called. This means that if one wants
to do an exchange with a specific peer and that exchange failed for whatever reason then the only way to try again
is to call DELETE and then issue a PUT with the same peer's name. Just issuing multiple sequential PUTs with the same
name won't restart the process from an error (or a success for that matter).

Request Content-Type: application/json
Request Body:

``` Javascript
{
   "peerDeviceID": "some ugly string",
}
```

Implementation: This is just a call to executeIdentityExchange. Only the peerDeviceId (aka peerIdentifier) is 
submitted so it's up to us to maintain a table (which we anyway need for GET IdentityExchange/ExecuteExchange) with
the associated public key hash needed to successfully call executeIdentityExchange. If there is an outstanding
call to ExecuteExchange and this call has the same peerDeviceID then this call is effectively a NOOP and should still
return 202 Accepted. If the device ID is different than the current one then the current device exchange must be
stopped with a call to stopExecutingIdentityExchange followed by a call to executeIdentityExchange. And yes this
can potentially cause a time out and has to be properly handled with a timedOut error and yes the handler still has
to work and record the result and drive the operation properly. And yes this means that we can end up with a problem
if we get multiple calls. But we should use the same global promise to serialize ExecuteExchange requests along with
calls to IdentityExchange. Note that if there hasn't been a PUT to IdentityExchange then this method is to fail 
with a 404 Not Found.

Tests:
* A PUT when there is no existing ExecuteExchange to make sure we start up correctly
* A PUT with a mock layer to make the executedIdentityExchange method take too long and cause a time out with
two variants:
 * In one the executeIdentityExchange call worked and we record that properly
 * In the other it failed and we recorded that properly
* A PUT where there is an existing ExecuteExchange with the same device ID, this should be a NOOP
* A PUT where there is an existing ExecuteExchange with a different device ID, this should cause a restart
* A PUT where there is an existing ExecuteExchange with a different device ID and the stopExecutingIdentityExchange
takes too long causes the response to return a timedOut with two variants:
 * In one the entire handler chain (e.g. stop followed by executeIdentityExchange) works and we confirm that the handler
did its job.
 * In one some part of the handler chain failed (e.g. either stopExecutingIdentityExchange or executeIdentityExchange)
and we make sure that the handler notices this and sets state correctly.
* Fire multiple PUT ExecuteExchange requests in a row and make sure they are serialized

## GET /webview/IdentityExchange/ExecuteExchange
Purpose: To check on the status of an identity exchange. Note that if no successful PUT to IdentityExchange and 
IdentityExchange/ExecuteExchange then this method will return 404 Not Found. Otherwise a JSON object will be returned
describing the current status of the exchange.

Response Content-Type: application/json
Response Body:

``` Javascript
{
   "peerDeviceID": "some ugly string",
   "status": "trying"
}
```

This indicates that the system is aware that it is supposed to perform an identity exchange with the listed device
ID and is trying to perform the exchange.

``` Javascript
{
   "peerDeviceID": "some ugly string",
   "status": "protocolFailure"
   "details": "some string with information"
}
```

This indicates that something failed during the protocol exchange. The user should check that the person they want
to exchange identities with is still available and has select them.

``` Javascript
{
   "peerDeviceID": "some ugly string",
   "status": "complete",
   "verificationCode": 123456,
   "publicKeyHash": "some ugly string"
}
```

This indicates that the identity exchange has successfully completed. The verification code is the value that has
to be shown to the user and confirmed with the other device. The public key hash is the validated public key hash
of the other peer.

Implementation: If we haven't gotten a callback yet from executedIdentityExchange then we return "trying". If we
got the callback and it was an error then we return "protocolFailure" and put the error message into details. If
we got a successfully callback then we return "complete". Note that the state is persistent until DELETE is called
or if PUT is called with a new device ID. Also note that we do NOT need to put this method (or any GET) on the global
promise. We just return whatever state we currently have.

Tests:
* Issue a GET when there is no PUT against IdentityExchange and make sure 404 is returned
* Issue a GET when there is a PUT against IdentityExchange but no PUT against IdentityExchange/ExecuteExchange and
make sure 404 is returned.
* Issue a PUT against a mock layer of identity exchange and make sure a GET returns "trying" if we are called before
the callback returns.
* Issue a PUT against a mock layer of identity exchange and make sure a GET returns "protocolFailure" along with
the proper "details" if the mock calls the callback with an Error.
* Issue a PUT against a mock layer of identity exchange and make sure a GET returns "complete" along with proper
verificationCode and publicKeyHash if the mock calls the callback with success.
* Issue a PUT against the mock layer, have the mock layer return a failure, then issue a GET and make sure we get
the error. Then issue another GET and make sure we are still getting the error. Then issue a PUT with the same name
and make sure it succeeds followed by another GET that returns an error. Remember that the only way to reset after
a success or a failure on the same name is by first calling DELETE.
* Do the previous test but with the mock layer returning success.


## DELETE /webview/IdentityExchange/ExecuteExchange
Purpose: To terminate the current ExecuteExchange. If there is no IdentityExchange or ExecuteExchange then 404 will
be returned. Otherwise the current exchange will be terminated. Note that if an exchange has ended (either in
success or failure) the only way to start a new exchange with the same device ID is to first call a DELETE. Calling
PUT multiple times with the same device ID does not cause the exchange to restart.

Implementation: If there is an outstanding ExecuteExchange then we have to call stopExecutingIdentityExchange to
terminate it. As with other methods we will hold the response until the callback returns. This could result in a
timeOut. Also note that we need to serialize this request against the global promise to prevent overlapping requests.

Tests:
* Issue a DELETE when there is no IdentityExchange object and get a 404
* Issue a DELETE when there is IdentityExchange but no IdentityExchange/ExecuteExchange and get a 404
* Issue a DELETE when there is an ExecuteExchange underway and make sure it stops
* Issue a DELETE with a mock layer to make sure stopExecutingIdentityExchange takes too long and make sure we
properly return a timeOut error to the response and then response handle properly records the eventual result of
the callback, either success or failure.


# TODO
HOW DO WE LET THE PERSON ON THE FRONTEND SEE CHANGES FROM THE BACKEND? DAVID IS USING THE CHANGES FEED BUT THAT
COULD POTENTIALLY ALLOW FOR RACE CONDITIONS. WE NEED TO THINK THIS THROUGH. BASICALLY WE WANT CHANGES AFTER A QUERY.
NEED TO THINK ABOUT THIS.
