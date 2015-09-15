# `IdentityExchange` Node Module #

This module implements the 
[Coin Flipping for Thali Identity Exchange Protocol](http://www.goland.org/coinflippingforthali/) to allow users of
Thali to securely exchange identification information.  Note that only one identity exchange can be done at a time 
and trying to exchange more than one identity at a time will result in an error.

## Usage ##

This is the basic usage of the `IdentityExchange` module.  Note that the public key hash comes from the 
`ThaliReplicationManager.prototype.getDeviceIdentity()` method.

## `IdentityExchange` Methods ##

The `IdentityExchange` module has the following methods:
- `constructor(app, replicationManager)`
- `startIdentityExchange(myFriendlyName, cb)`
- `stopIdentityExchange(cb)`
- `executeIdentityExchange(peerIdentifier, otherPkHash, myPkHash, cb)`
- `stopExecutingIdentityExchange(peerIdentifier, cb)`

The `IdentityExchange` module has the following events:
- `peerIdentityExchange`

### `IdentityExchange` State Machine
```
(start) ---startIdentityExchange------------> (startIdentityExchange)
  /\                                          |  |             /\  /\
  |                                           |  |              |  |
  ---------stopIdentityExchange----------------  |        stopExecutingIdentityExchange
                                                 |              |  |
                                      executeIdentityExchange   |  error
                                                 |              |  |
                                                 \/             |  |
                                         (executingIdentityExchange)
```

The identity exchange object implements a very limited state machine. Only certain methods are legal
in various states. Attempts to use a method that isn't legal in a state will result in an Error being
thrown.

### `constructor(app, replicationManager)`
This constructs the `IdentityExchange` module specifically with the Express-PouchDB instance used with Thali.
Once the constructor is called it will begin emitting peerIdentityExchange events if it find any peers who wish
to perform an identity exchange. So one is well advised to listen for those events before executing 
startIdentityExchange.

__WARNING__ - For the moment we require that the replicationManager that was passed into us is in the stop 
state (or has
never been started). Otherwise we will break. Note however that this requirement will eventually be removed. 
It's just a short term hack until we put in the proper native support for changing characteristics we are 
advertising and fix up our connection/broadcast infrastructure to properly segregate it from the replication
manager.

#### Arguments
1. `app`: `express` - Thali's Express-PouchDB Express application instance
2. `replicationManager`: `ThaliReplicationManager` - a `ThaliReplicationManager` instance used for replicating 
data between devices.

#### Return Value
`IdentityExchange` - the initialized `IdentityExchange` module used for identity exchange between devices.

#### Example
```js
var os = require('os');
var express = require('express');
var ThaliReplicationManager = require('thali/thalireplicationmanager');
var IdentityExchange = require('thali/identityexchange');

// Thali Express-PouchDB
var dbPath = path.join(os.tmpdir(), 'dbPath');
var LevelDownPouchDB = process.platform === 'android' || process.platform === 'ios' ?
    PouchDB.defaults({db: require('leveldown-mobile'), prefix: dbPath}) :
    PouchDB.defaults({db: require('leveldown'), prefix: dbPath});

var app = express();
app.use('/db', require('express-pouchdb')(LevelDownPouchDB, { mode: 'minimumForPouchDB'}));
var db = new LevelDownPouchDB('thali');
app.listen(5000);

// Thali
var replicationManager = new ThaliReplicationManager();

var identityExchange = new IdentityExchange(app, replicationManager);
```

#### Protocol
N/A

#### Implementation
Mostly we have to set the global state machine to `start`.

#### Tests
* Make sure that the global state machine's state is `start`.
* Make sure that calling any method but startIdentityExchange will fail.
* Make sure the protocol endpoints defined in this doc all return 400 Bad Request

***

### `startIdentityExchange(myFriendlyName, cb)`

This method starts the process of advertising the device's desire to perform an identity exchange.

#### Arguments
1. `myFriendlyName`: `string` - The friendly name to broadcast to other devices as the identity of the device.
2. `callback`: `Function` – must be in the form of the following, `function (err)` where:
  - `err` : `Error` – an `Error` if one occurred, else `null`

#### Example
```js
// Advertise my name
var myFriendlyName = '...';

identityExchange.startIdentityExchange(myFriendlyName, function (err) {
  if (err) {
    throw err;
  }

  console.log('Started broadcasting my name as %s', myFriendlyName);
});
```

#### Protocol
By default a device is not available for identity exchange. As such, starting with story 0.0, we advertise a
hash of our public key and that is it. In future stories even that will go away to be replaced with encrypted
beacons that will let us advertise who we want without exposing our own identity. But for now we play a silly
trick to let other nodes know if we are available for identity exchange, we set our peer name (usually the
public key hash) to include a ";" at the end followed by a string. The ";" signals that we want to do an 
identity exchange
and the string afterwards is our 'friendly name' that we want displayed to other users to identify us.

Note that the submitted friendly name has to be a string and contain at least one character.

Eventually we will switch all of this to be a dedicated BLE characteristic. But that will happen when we add in
notification support and extend the discovery API to enable finer grained control.

#### Implementation
We are advertising
our availability for identity exchange via the peer name and not its own dedicated value. For now that means we
have to start the replication manager (which remember was supposed to be passed to us in the stopped state)
with our public key hash + ";" + whatever friendly name the user submitted. Eventually this will all go away
and we can instead just set the characteristic directly.

Our first step in any case is to make sure the friendly name is a string that contains at least one character.

Until we call the callback no other methods should be allowed to execute so we have to have a lock value to
guarantee this. 

Even when we have called the callback the only legal methods to call at this point are either stopIdentityExchange
or executeIdentityExchange.

#### Tests
* We need to mock the replication manager and test that we properly call start with the right
device name. Note that this will require mocking up the started events.
* Make sure that we will return an error if we receive a friendly name that isn't a string that contains at least
one character.
* Make sure that we will return an error if we get a startError from the replication manager.
* Make sure that we will return an error if start is called twice in a row.
* Confirm that no other methods can be called until startIdentityExchange has called back its callback.
* Confirm that once startIdentityExchange has called its callback the only method that can be called without an
exception on the object is stopIdentityExchange or executeIdentityExchange.
* Make sure our protocol endpoints return 400 Bad Request
* Make sure that once we call the callback we are in startIdentityExchange mode

***

### `stopIdentityExchange(cb)`

This method stops advertising for identity exchanges. 

__Note__ - When this method is finished the replication
manager object that was passed in will be in the stop state. Eventually this will no longer be true once
we have added the right native apis to allow us to change the characteristics we are advertising. But this means
that after calling stopIdentityExchange one has to call start on the replication manager!

#### Arguments
1. `callback`: `Function` – must be in the form of the following, `function (err)` where:
  - `err` : `Error` – an `Error` if one occurred, else `null`

#### Example
```js
identityExchange.stopIdentityExchange(function (err) {
  if (err) {
    throw err;
  }

  console.log('Stopped broadcasting my name as %s', myFriendlyName);
});
```

#### Protocol
We stop advertising anything.

#### Implementation
We need to call stop broadcasting.

#### Tests
* We need to mock the replication manager and test that we are properly calling stop.
* Make sure we return an error if the replication manager cannot be stopped.
* Make sure no other methods can be successfully called until stopIdentityExchange has called back its callback.
* Make sure that once stopIdentityExchange has called its callback no other method can be successfully called
but startIdentityExchange.
* Make sure our protocol endpoints return 400 Bad Request
* Make sure that once we call the callback we are in start state

***

### `executeIdentityExchange(peerIdentifier, otherPkHash, myPkHash, cb)`

This executes the identity exchange between two devices with a given peer identifier, the peer's public key hash, 
your public key hash and a callback.

#### Arguments
1. `peerIdentifier`: `String` - the peer identifier of the remote device to connect to.
2. `otherPkHash`: `String` - the primary key hash for the other device to connect to.
3. `myPkHash`: `String` - the primary key hash for the current device.
4. `callback`: `Function` – must be in the form of the following, `function (err, number)` where:
  - `number`: `Number` - a six digit number used for verifying the identity
  - `err`: `Error` – an `Error` if one occurred, else `null`

#### Example
```js
// Execute identity exchange with other discovered peer
identityExchange.executeIdentityExchange(otherPeer, otherPkHash, myPkHash, function (err, number) {
  if (err) {
    throw err;
  }

  console.log('Six digit verification number is %d', number);
});
```
#### Protocol
In the abstract protocol the first step is exchanging public keys. In our case we will exchange public key
hashes and because of how discovery works we get this exchange of public keys for free. So we can skip that
step all together.

We initially generate Cb (see next section for definition) along with rnMine.

Ideally the two request/response pairs we send below would be sent over TLS and that would be how we confirm
that we are getting the public keys we expect. But making that work requires our notification system along with
an extension to node to let us use AES128-GCM-SHA256 as our cipher suite using pre-shared keys defined via HKDF
over the notification discovery channel. But we aren't ready for that now so for now we just explicitly include
a value with the hash of the key of the person sending the request. Of course this is not private and will be 
replaced.

The actual on the wire protocol contains exactly two, ordered, request/response pairs.

First send a POST to /identity/cb with the request body:

``` Javascript
{
    "cbValue": "base 64 string with cbValue",
    "pkMine": "base 64 representation of PKHashMine"
}
```

In the response we expect to receive a 200 OK containing a response body with:

``` Javascript
{
   "rnOther": "The base 64 version of RNOther",
   "pkOther": "The base 64 representation of PKHashOther"
}
```

We have to validate that the received pkOther value matches otherPKHash.

If the machine receiving the request either isn't interested in doing an identity exchange or specifically doesn't
want to do an identity exchange with this peer then it will return a 400 Bad Request.

We then send a POST to /identity/rnmine with the request body:

``` Javascript
{
   "rnMine": "The base 64 version of RNMine",
   "pkMine": "base 64 representation of PKHashMine"
}
```

We then expect back a 200 response containing a response body with:

```Javascript
{
   "pkOther": "The base 64 representation of PKHashOther"
}
```

At that point we can generate the 6 digit validation code.

If the machine receiving the request either isn't interested in doing an identity exchange or specifically doesn't
want to do an identity exchange with this peer then it will return a 400 Bad Request.

#### Attack analysis
Imagine there are two devices, device A and device B which have public keys pkA and pkB. An attacker wants to
substitute their public key, pkEvil for, lets say, pkB.

For the sake of argument we are going to assume that there is no reasonable way for the attacker to pick a
public key hash that collides with either device A or device B's public key hashes.

So the only attack is a man in the middle attack where the attacker fools device A into doing an identity
exchange with device Evil and simultaneously fools device B into doing an identity exchange with device Evil. Even
then the attacker has to create a situation where the numeric values generated by the two different identity
exchanges are the same. As far as I can tell the only known attack against the algorithm is a brute force
attack where the attacker just tries different values until they get lucky. To make things sane the attacker
will probably just pick one device to hold steady (e.g. do an identity exchange with once and get a value) and
then try to attack the other device.

Although this is not always the case we will assume (in order to give the edge to the attacker) that 
hash(pkA) < hash(pkEvil) < hash(pkB). This means that the attacker can choose to either attack with a smaller or 
larger hash depending on whichever is more advantageous.

If choosing to have a smaller hash then the attacker picks their RNmine, generates a Cb and sends it to device B.
As soon as the RNother is received in the first response the attacker knows if the 6 digit number will match the
number generated with device A. If the number won't match then the attacker will want to try again with a new
RNmine. That is possible if the attacker is allowed to repeat the first request with a new Cb. This attack is
particularly effective if the victim doesn't change their RNmine. In that case the attacker can generate
about 1,000,000 or so RNmine values until finding one that will produce the desired 6 digit hash code.

If choosing to have a larger hash then the attacker waits to receive Cb, sends its RNmine but it can't figure
out if attack will work until the second request with the RNother is received. At this point the attacker knows
if the attack will succeed or fail. But the only way to reset the attack is to somehow get the victim to
resend Cb and accept a new RNmine. If the victim doesn't switch to a new RNmine then the attacker only needs to
have enough time to try out 1,000,000 or so RNmine values to find one that will produce the right 6 digit hash.

It's tempting to argue that switching RNmine frequently is a good defense but if RNmine is switched too frequently
then the attacker could get enough requests in to potentially end up with a matching 6 digit hash just through
dumb luck. But in this case dumb luck is going to require a million or so RNmine switches.

So we need a balance. On one hand we need to switch our RNmine on a frequent enough basis to not give the attacker
time to calculate a matching value. On the other hand we need to not change our RNmine so frequently that the
attacker can get in enough requests to match the desired hash by dumb luck.

Given the power of cloud computing I have to assume that an attacker can generate a million (or even a billion)
trial values more or less instantaneously once they get the victim's values. So I think this argues that we just
can't risk ever using the same RNmine twice.


#### Implementation
The state machine explicitly prohibits any calls while in the executingIdentityExchange state other than
stopExecutingIdentityExchange. We have to enforce that. This applies even after the callback is called.

We must also be in a situation where startIdentityExchange has already been called. So we need to check for that
and if it hasn't happened then we have to throw since this shouldn't have happened.

__Note:__ - At this point we have to figure out if we are connected to the other peer and if so what port we are 
using to talk
to them. This is another one of those temporary situations. Right now the replication manager will connect to anyone
it finds who is advertising Thali support. So whatever peer we want to do an identity exchange with is going to
be a Thali peer and so the replication manager should have already connected to them and have a local port we can
use to talk to them. This is yet another hack. In the real final implementation we would never connect to a
peer we hadn't done an identity exchange with. Otherwise, what's the point of doing an identity exchange? But for
now we connect to everyone. So we wait for a special connectSuccess event with peer ID we are looking for the mux
port to tell us where to connect to. So what this means is that as soon as we call start on the replication
manager we will record all the 'connectSuccess' events and keeping them in a table by peer ID with the value
being the port.





When we are under attack what the attacker needs depends on the size of the hash they are trying to spoof. If the
hash is larger than ours then the attacker wants us to hold our RNmine value for as long as possible so they can
try to brute force a RNother

In the case that we have the smaller hash on a key exchange then we control the pace of the exchange but it is
in the interests of an attacker to keep trying to have us fail for as long they can in order to try and brute
force a RNother that will work. So this argues that we want to rotate our RNmine on a frequent basis to frustrate
such brute force attacks. Unfortunately this does cause a race condition where we have successfully sent 
/identity/cb and the other party is locked in to that cb value and we switch rnMine and now will try to send
a new cb value that will be rejected by the other party because it doesn't match the locked cb value.

From the other side, if we have the larger hash, then the attacker wants to keep us locked on our RNmine as long
as possible so they have time 



We explicitly do not handle peerAvailabilityChanged events regarding the peer we have been asked to perform
an identity exchange with. There are lots of reasons why such a peer could disappear, stop advertising their
interest in performing an identity exchange, etc. For example, someone could start an identity exchange, get
confused, stop and then start it again. To the extent that the app using identity exchange wants to deal
with these issues it has to track the peerIdentityExchange event and decide when it wants to start and stop
identity exchange. This also makes brute force attacks quite difficult since we rarely change 


First we have to use the crypto library to generate a cryptographically secure 128 bit random number called
RNmine.

Then we have to base 64 decode both otherPkHash and myPkHash and compare them as binary values. 

##### If our public key hash is smaller than the other public key hash
We have to calculate CbRaw using SHA256(RNmine, myPkHashRaw || otherPkHashRaw) and then encode that result as
CbBase64 for transport.

At that point we will look to see if our connection table contains the peer we want to talk to. If it doesn't
then we will just wait for the next connectSuccess event and see if its the peer we want. We can stay waiting
forever if necessary.

Once we get the port we need then we will fire off a POST to /identity/cb. If we get a 400 Bad Request then we
will setInterval for some time period and try again. There is a nice race condition where our current device
wants to do an identity exchange but the remote device hasn't gotten ready yet. So we just keep retrying.

If we get a 200 then we will check pkOther and make sure it matches (using a binary comparison after base
64 decoding the value) what pk we are looking for. If it doesn't match then we have to assume there has been
some kind of port screw up and we will retry the algorithm after a setInterval hoping that a new connect fixes
things. We then have to check rnOther and based 64 decode it and make sure it is a 256 bit binary value. If
that isn't the case then we are either dealing with a buggy implementation or an attack and we need to return
an error to the CB and switch back to startIdentityExchange.

If we get any kind of connection error then we will retry the algorithm after a setInterval hoping for a new 
connection.

If we get the pkOther we are looking for then we will return rnOther and generate rnOtherRaw (e.g. the base64
unencoded value) and we will then issue a POST to /identity/rnmine.
 
The error handling is as above. For each of the possible errors we will start the algorithm from scratch.
 
If it all works then we will generate the 6 digit value by by generate SHA256(RNother, PKother || PKMine ||
RNMine)mod 2^32 and then moding the value by 10^6. At that point we will call the callback with the 
confirmation code and then we will just stop. Nothing more will happen until stopExecutingIdentityExchange
is called.
 
A possible complication is that at any time someone can call stopExecutingIdentityExchange (all the other
methods will be blocked). If that happens we have to abandon any setIntervals we have and also remove any
handlers we have waiting to hear about a specific peerID with connectionSuccess.

##### If our public key hash is larger than the other public key hash
If we aren't in executingIdentityExchange then any requests to /identity/cb or /identity/rnmine will
result in 400 Bad Request. If we are in executingIdentityExchange than we will check pkMine in requests
to make sure they match the value we are looking for.




There is a tiny state machine here. We will only honor an /identity/rnmine request if we have a registered
cbValue from an /identity/cb request. Otherwise we will reject the /identity/rnmine request with a 400 Bad
Request.

If we receive an /identity/rnmine request then first we need to validate that cbValue is uuencoded into a
256 bit value. We also have to make sure that pkMine matches the pKother we are looking for. We will generate 
a local Cb via SHA256(RNOther, PKOther | PKmine).
If that value doesn't match the value we received in the previous /identity/cb request then we will dump
all state and act like nothing has happened. We can't tell the difference between an attack and a race condition
so we just reset and wait for another set of requests. But if the cb value doesn't match then we have to return
a 400 Bad Request.

If the Cb is good then return the validation number in the callback per the previous section.

Note that once we have called the callback with a success, for as long as we are still in executingIdentityExchange
we will continue to accept /identity/cb and /identity/rnmine requests but ONLY if the values in the
requests exactly match the values we have already received. Otherwise we will return 400 Bad Request. This contains
a race condition where device A starts an identity exchange, has a bunch of problems executing the exchange
with B. Finally /identity/rnmine gets successfully sent to B but the response is lost for some reason. A timer
on device A then gives up and stops the identity exchange which is then started again (now with a new rnmine)
but B thinks everything was fine and is expecting the old rnmine value. The identity exchange can now never succeed
until B gives up and resets. Rather than adding more protocol complexity to deal with this edge case the real
solution is to have relatively short (say 5 seconds, actual value will depend on our perf results) periods of time
where we try an identity exchange before stopping and restarting (with a new rnmine).

#### Tests
* Make sure that the only method that can be called once we have started executeIdentityExchange is
stopExecutingIdentityExchange.
* Make sure that when stopExecutingIdentityExchange is called we successfully stop any setIntervals that
are hanging around as well as any handlers looking for a specific peer ID in the connectionSuccess event
handler.
* Make sure HTTP requests sent when we aren't in executingIdentityExchange state will all fail with 400
Bad Request
* Issue /identity/cb and /identity/rnmine response with the wrong pkOther and either absent or too small
or too large rnOther
* Simulate connection failures and 400 failures on outgoing requests and make sure we retry properly
* Start an identity exchange and then stop it in the middle
* Receive /identity/cb and /identity/rnmine responses with the wrong pkMine values
* Make an /identity/cb request with a cbValue that is absent or too small or too large
* Make an /identity/rnmine request with a rnMine value that is absent, too small or too large
* Make an /identity/rnmine request without first having made an /identity/cb request
* Send malformed requests and make sure they are rejected
* Send an /identity/rnmine request which generates a CB that doesn't match the value from /identity/cb
* Get an identity exchange all the way to success and then re-send /identity/cb and /identity/rnmine both
with the same values as the previously successful requests and with different values. The later should fail. Then
reset in and out of executingIdentityExchange and do a new identity exchange just to make sure things cleared
properly.
* Make sure that even once we call the callback we are still in executingIdentityExchange

***

### `stopExecutingIdentityExchange(peerIdentifier, cb)`

This stops an outstanding attempt to end a peer identity exchange with the specified peer Identifier. It is an 
error to call this method if the outstanding identity exchange isn't with this peer identifier or if there is no
outstanding identity exchange.

#### Arguments
1. `peerIdentifier`: `String` - the peer identifier of the remote device we are attempting to exchange identities
with
2. `callback`: `Function` - must be in the form of the following, `function (err)` where:
 - `err`: `Error` = an `Error` if one occurred, else `null`

#### Protocol
This is really the lack of a protocol.

#### Implementation
Our first check is to make sure that the we are actually in executingIdentityExchange mode or we should throw.
Our second check is to make sure that the submitted peerIdentifier is the one we are in executingIdentityExchange
mode with.
At that point we just switch the endpoints off and set the global mode 

#### Tests
* Make sure we properly enforce the state machine, that we only allow this method if we are in
executingIdentityExchange mode
* Make sure that the peerIdentifier matches the one we are in executingIdentityExchange mode with.
* Make sure our protocol endpoints return 400 Bad Request
* Make sure when we exit this method we are in startIdentityExchange mode

***

## Events

### `peerIdentityExchange`

This event is called when a remote peer wants to do an identity exchange

#### Callback Arguments:

1. `peer`: `PeerAvailability` - A peer with the following information:
- `peerIdentifier`: `String` – the peer identifier
- `peerName`: `String` – the peer public key hash
- `peerAvailable`: `Boolean` – whether the peer is available or not
- `peerFriendlyName`: `String` - the peer friendly name to advertise

#### Example:

#### Protocol
As previously described this event occurs when we get a notification with a peer name that includes a ";". The
value after the ";" is the friendly name.

#### Implementation
We have to check incoming announcements to make sure that if they do contain a ";" that the following value is
a string containing at least one character.

#### Tests
* Mock up an announcement without a ";" and make sure we don't fire peerIdentityExchange
* Mock up an announcement with a ";" but with out a friendly name value and make sure we don't fire
peerIdentityExchange
* Mock up an announcement with a ";" and a legit friendly name and make sure we do fire peerIdentityExchange
* No do all the previous but with the peerAvailabilityNotification mock changed to be peerAvailable = false
and make sure things still work.

***
