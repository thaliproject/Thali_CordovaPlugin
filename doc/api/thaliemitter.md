# The `ThaliEmitter` class

The `ThaliEmitter` class is a bridge between the native connectivity API and JavaScript to use the Thali local discovery and peer to peer capabilities with TCP/IP servers and clients without the rest of the Thali infrastructure needed.  This is intended to eventually be moved to its own NPM module.

## Usage

This is the basic usage to listen for the `peerAvailabilityChanged` event as well as start broadcasting the availability of the current device.

```js
var ThaliEmitter = require('thali/thaliemitter');

var emitter = new ThaliEmitter();

emitter.on('peerAvailabilityChanged', function (peers) {
  // Handle the peers status changed
  peers.forEach(function (peer) {
    console.log('Peer Identifier: %s', peer.peerIdentifier);
    console.log('Peer is available? %s', peer.isAvailable);
  });
});

emitter.startBroadcasting('me', 9001, function (err) {
  if (err) {
    console.log(err);
  } else {
    console.log('We are now broadcasting availability on port 9001');
  }
});
```

## API

## Instance Methods
- `startBroadcasting(deviceName, portNumber, callback)`
- `stopBroadcasting(callback)`
- `connect(peerIdentifier, callback)`
- `disconnect(peerIdentifier, callback)`

## Events
- `networkChanged`
- `peerAvailabilityChanged`

***

## Constructor

### `ThaliEmitter.constructor`

This creates a new instance of the `ThaliEmitter` class which acts as a bridge between the native layer and JavaScript to provide local discovery and peer to peer communication with TCP/IP clients and servers.

#### Example:

```js
var ThaliEmitter = require('thali/thaliemitter');

var emitter = new ThaliEmitter();
```

***

## Methods

### `ThaliEmitter.prototype.startBroadcasting(deviceName, portNumber, callback)`

This method instructs the native layer to broadcast the availability of the device under the specified deviceName and to direct any incoming connections to the specified port number available on localhost over TCP/IP.  Calling this method twice without a `stopBroadcasting` call in between will result in an error.

#### Arguments:

1. `deviceName` : `String` – the device name.
2. `portNumber` : `Number` – a port number to direct any incoming TCP/IP connections
3. `callback` : `Function` – must be in the form of the following, `function (err)` where:
  - `err` : `Error` – an `Error` if one occurred, else `null`

#### Example:

```js
var ThaliEmitter = require('thali/thaliemitter');

var emitter = new ThaliEmitter();

emitter.startBroadcasting('me', 9001, function (err) {
  if (err) {
    console.log(err);
  } else {
    console.log('We are now broadcasting on port 9001');
  }
});
```
***

### `ThaliEmitter.prototype.stopBroadcasting(callback)`

This method stops advertising or broadcasting of its availability.

#### Arguments:

1. `callback` : `Function` – must be in the form of the following, function (err) where:
  - `err` : `Error` – an `Error` if one occurred, else `null`

#### Example:

```js
var ThaliEmitter = require('thali/thaliemitter');

var emitter = new ThaliEmitter();

emitter.startBroadcasting('me', 9001, function (err) {
  if (err) {
    console.log(err);
  } else {
    // Stop broadcasting after 5 seconds
    setTimeout(function () {
      emitter.stopBroadcasting(function (err) {
        if (err) {
          console.log(err);
        } else {
          console.log('Stopped broadcasting on port 9001');
        }
      })
    }, 5000);
  }
});
```
***

### `ThaliEmitter.prototype.connect(peerIdentifier, callback)`

This method begins a connection to the given peer found during discoverability.  If this is called twice with the same peer identifier, an error will be thrown that it is in process.

#### Arguments:

1. `peerIdentifier` : `String` – peer identifier found during the `peerAvailabilityChanged` event.
2. `callback` : `Function` – must be in the form of the following, `function (err, port)` where:
    - `err` : `Error` – an `Error` if one occurred, else `null`
    - `port` : `Number` – the port to connect to the other server for PouchDB synchronization, e.g. `5678` so that we can synchronize to `http://localhost:5678/dbname`

#### Example:

```js
var ThaliEmitter = require('thali/thaliemitter');

var emitter = new ThaliEmitter();

emitter.on('peerAvailabilityChanged', function (peers) {
  peers.forEach(function (peer) {

    if (peer.peerAvailable) {
      emitter.connect(peer.peerIdentifier, function (err, port) {
        if (err) {
          console.log(err);
        } else {
          console.log('Connected to peer on port %s', port);
        }
      });
    }
  });
});
```
***

### `ThaliEmitter.prototype.disconnect(peerIdentifier, callback)`

This method disconnects from the given peer by the given peer identifier.  If the peer is already disconnected, then no error shall be thrown.

#### Arguments:

1. `peerIdentifier` : `String` – peer identifier found during the peerAvailabilityChanged event.
2. `callback` : `Function` – must be in the form of the following, `function (err)` where:
    - `err` : `Error` – an `Error` if one occurred, else `null`

#### Example:

```js
var ThaliEmitter = require('thali/thaliemitter');

var emitter = new ThaliEmitter();

emitter.on('peerAvailabilityChanged', function (peers) {
  peers.forEach(function (peer) {

    if (!peer.peerAvailable) {
      emitter.disconnect(peer.peerIdentifier, function (err) {
        if (err) {
          console.log(err);
        } else {
          console.log('Disconnected from peer %s', peer.peerIdentifier);
        }
      });
    }
  });
});
```
***

## Events

### `peerAvailabilityChanged`

This event is called when a peer’s availability has changed.

#### Callback Arguments:

1. `peers` : `Array<PeerAvailability>` where `PeerAvailability` has the following properties:
    - `peerIdentifier` : `String` – the peer identifier
    - `peerName` : `String` – the name of the peer
    - `peerAvailable` : `Boolean` – whether the peer is available or not

#### Example:

```js
var ThaliEmitter = require('thali/thaliemitter');

var emitter = new ThaliEmitter();

emitter.on('peerAvailabilityChanged', function (peers) {
  peers.forEach(function (peer) {
    console.log('Peer identifier %s', peer.peerIdentifier);
    console.log('Peer name %s', peer.peerName);
    console.log('Peer available? %s', peer.peerAvailable);
  });
});
```
***

### `networkChanged`

This event is called when the network has changed.

#### Callback Arguments:

1. `networkChanged` : `NetworkChanged` where it has the following properties:
    - `isAvailable` : `Boolean` – whether the network is available
    - `isWifi` : `Boolean` – whether or not the network is WiFi

#### Example:

```js
var ThaliEmitter = require('thali/thaliemitter');

var emitter = new ThaliEmitter();

emitter.on('networkChanged', function (status) {
  console.log('Network is available? %s', status.isAvailable);
})
```
