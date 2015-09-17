# `IdentityExchange` Node Module #

This module implements the [Thali Identity Exchange Protocol](http://www.goland.org/thaliidentityexchangeprotocol/)
 to allow users of
Thali to securely exchange identification information.  Note that only one identity exchange can be done at a time 
and trying to exchange more than one identity at a time will result in an error. This module is actually the internal
backend. It is generally expected that it will be primarily called through the [REST front end](thaliBrowserRESTAPI.md)
we have created for identity exchange although this is not strictly required.

## `IdentityExchange` State Machine
``` PlantUML
[*] --> wait : constructor called

wait --> findPeersDoingIdentityExchange : startIdentityExchange called

findPeersDoingIdentityExchange --> wait : stopIdentityExchange called
findPeersDoingIdentityExchange --> exchangeIdentity : executeIdentityExchange called

exchangeIdentity --> wait : stopIdentityExchange called
exchangeIdentity --> findPeersDoingIdentityExchange : stopExecutingIdentityExchange called
```

![IdentityExchange State Machine](http://plantuml.com/plantuml/png/YzQALT3LjLCeJymiKR1IICxFAoufAaqkoIzII4xCoKbDuU82Iu7Kf6NcfGIafXOLk-HdvgLxfgJcbMIMLBfM96SavgMd0dKNboGMbM28mymXe1t95SKb-GMuZ272b5Ge1oO9D36r8ZMvj2GLfzimj13f6gpwY0Yd_09Ni8kmoKEC1W00)

Eventually we will be able to complete separate finding peers to do identity exchange with and executing
an identity exchange. But right now they are coupled because we depend on a call to startBroadcasting
that we do as part of finding peers to do identity exchange to collect connectSuccess events to find
the port for a peer. Yes, we could work around that even now but boy, life is short so let's just keep it
simple.

### Global Objects
While running the state machine we have a number of objects global to the state machine.

app - This is passed in on the constructor and is the server that we will add the two identity exchange endpoints
to.

replicationManager - This is a Thali replication manager object in the stop state that was passed to us on the
constructor.

connectionTable - This is an object on which the property names are peerIDs and the value is an object with
two properties, port and time. This object is updated anytime we receive a connectionSuccess event from the
replication manager. We will store the peerID and port in the event and then specify what time we received
the event. The time is needed so that in cases where we believe we have a channel binding problem we know
that we have a freshly updated port.

### State: Wait
In this state the replication manager is not running. So essentially Thali is shut down. We require that the
replication manager we are passed on the constructor is turned off and if we transition to this state from
another state (which is only possible via the stopIdentityExchange) then we will turn off
the replication manager.

Note that we will hook up the identity exchange endpoints, all returning 404 Not Found, in this state.

### State: findPeersDoingIdentityExchange
In this state the replication manager is running and we are listening to connectionSuccess events to build
up the connectionTable. We are also advertising our friendly name.

### State: exchangeIdentity
In this state we will run the two subsidiary state machines discussed in the article linked above. This is the
first time we will respond to requests to the identity exchange endpoints with something other than 404 Not Found.

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

### `constructor(app, replicationManager)`
This constructs the `IdentityExchange` module specifically with the Express-PouchDB instance used with Thali.

__WARNING__ - For the moment we require that the replicationManager that was passed into us is in the stop 
state (or has
never been started). Otherwise we will break. Note however that this requirement will eventually be removed. 
It's just a short term hack until we put in the proper native support for changing characteristics we are 
advertising and fix up our connection/broadcast infrastructure to properly segregate it from the replication
manager.

#### Arguments
1. `app`: `express` - Thali's Express-PouchDB Express application instance
2. `replicationManager`: `ThaliReplicationManager` - a `ThaliReplicationManager` instance used for replicating 
data between devices. It's state must be off.

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

#### Tests
* Make sure the protocol endpoints defined in this doc all return 404 Not Found

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

#### Tests
* We need to mock the replication manager and test that we properly call start with the right
device name. Note that this will require mocking up the started events.
* Make sure that we will return an error if we receive a friendly name that isn't a string that contains at least
one character.
* Make sure that we will return an error if we get a startError from the replication manager.
* Confirm that no other methods can be called until startIdentityExchange has called back its callback.
* Make sure our protocol endpoints return 400 Bad Request with notDoingIdentityExchange.

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

#### Tests
* We need to mock the replication manager and test that we are properly calling stop.
* Make sure we return an error if the replication manager cannot be stopped.
* Make sure no other methods can be successfully called until stopIdentityExchange has called back its callback.
* Make sure our protocol endpoints return 400 Bad Request

***

### `executeIdentityExchange(peerIdentifier, otherPkHash, myPkHash, cb)`

This executes the identity exchange between two devices with a given peer identifier, the peer's public key hash, 
your public key hash and a callback.

The callback can be called multiple times, potentially with different validation numbers if the other peer is
having problems. Callbacks can continue until stopExecutingIdentityExchange or stopIdentityExchange are called.

Also note that once a verification value has been returned generally one should keep executeIdentityExchange going
for a little bit just to make sure the other side is all right.

That having been said the longer the system is in this state the more risk there is of a successful attack.
In general the caller should not allow the system to remain in this state for more than a handful of minutes.

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

#### Tests
* Basically launch the tests for the subsidiary state machines.

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

#### Tests

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

#### Tests
* Mock up an announcement without a ";" and make sure we don't fire peerIdentityExchange
* Mock up an announcement with a ";" but with out a friendly name value and make sure we don't fire
peerIdentityExchange
* Mock up an announcement with a ";" and a legit friendly name and make sure we do fire peerIdentityExchange
* No do all the previous but with the peerAvailabilityNotification mock changed to be peerAvailable = false
and make sure things still work.

***
