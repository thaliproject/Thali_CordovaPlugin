# The `ThaliEmitter` class

The `ThaliEmitter` class is a bridge between the native connectivity API and JavaScript to use the Thali local discovery and peer to peer capabilities with TCP/IP servers and clients without the rest of the Thali infrastructure needed.  This is intended to eventually be moved to its own NPM module.

## Usage

This is the basic usage to listen for the `peerAvailabilityChanged` event as well as start broadcasting the availability of the current device.

```js
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

## Methods

### `ThaliEmitter.prototype.startBroadcasting(deviceName, portNumber, callback)`

This method starts advertising or broadcasting its availability at the following port that PouchDB/Express-PouchDB is listening.  

#### Arguments:

1. `deviceName` : `String` – the device name.
2. `portNumber` : `Number` – obtained by the user of the code which indicates the port number of our local PouchDB/Express-PouchDB
3. `callback` : `Function` – must be in the form of the following, `function (err)` where:
  - `err` : `Error` – an `Error` if one occurred, else `null`

#### Example:

```js
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
emitter.on('networkChanged', function (status) {
  console.log('Network is available? %s', status.isAvailable);
})
```
