# Thali Cordova Peer Communication API #

## Methods:
- `StartBroadcasting`
- `StopBroadcasting`
- `Connect`
- `Disconnect`
- `KillConnection`

Events:
- `peerAvailabilityChanged`
- `networkChanged`

***

METHODS:

***

### `StartBroadcasting(deviceName, portNumber, callback)`

This method starts advertising or broadcasting its availability at the following port that PouchDB/Express-PouchDB is listening.  

#### Arguments:

1. `deviceName` : `String` – the device name.
2. `portNumber` : `Number` – obtained by the user of the code which indicates the port number of our local PouchDB/Express-PouchDB
3. `callback` : `Function` – must be in the form of the following, `function (err)` where:
  - `err` : `String` – a string value containing the error if one occurred, else `null`

***

### `StopBroadcasting(callback)`

This method stops advertising or broadcasting of its availability.

#### Arguments:

1. `callback` : `Function` – must be in the form of the following, function (err) where:
    - `err` : `String` – a string value containing the error if one occurred, else `null`

***

### `Connect(peerIdentifier, callback)`

This method begins a connection to the given peer found during discoverability.  If this is called twice with the same peer identifier, an error will be thrown that it is in process.

#### Arguments:

1. `peerIdentifier` : `String` – peer identifier found during the `peerAvailabilityChanged` event.
2. `callback` : `Function` – must be in the form of the following, `function (err, port)` where:
    - `err` : `String` – a string value containing the error if one occurred, else null
    - `port` : `Number` – the port to connect to the other server for PouchDB synchronization, e.g. 5678 so that we can synchronize to `http://localhost:5678/dbname`

***

### `Disconnect(peerIdentifier, callback)`

This method disconnects from the given peer by the given peer identifier.  If the peer is already disconnected, then no error shall be thrown.

#### Arguments:

1. `peerIdentifier` : `String` – peer identifier found during the peerAvailabilityChanged event.
2. `callback` : `Function` – must be in the form of the following, `function (err)` where:
    - `err` : `String` – a string value containing the error if one occurred, else `null`

***

### `KillConnection(peerIdentifier, callback)`

This method kills the connection for the given peer identifier to simulate crashes.  This is not intended for use in production code.

#### Arguments:

1. `peerIdentifier` : `String` – peer identifier found during the peerAvailabilityChanged event.
2. `callback` : `Function` – must be in the form of the following, `function (err)` where:
    - `err` : `String` – a string value containing the error if one occurred, else `null`

***

EVENTS:

***

### `peerAvailabilityChanged`

This event is called when a peer’s availability has changed.

#### Callback Arguments:

1. `peers` : `Array<PeerAvailability>` where `PeerAvailability` has the following properties:
    - `peerIdentifier` : `String` – the peer identifier
    - `peerName` : `String` – the name of the peer
    - `peerAvailable` : `Boolean` – whether the peer is available or not

***

### `networkChanged`

This event is called when the network has changed.

#### Callback Arguments:

1. `networkChanged` : `NetworkChanged` where it has the following properties:
    - `isAvailable` : `Boolean` – whether the network is available
    - `isWifi` : `Boolean` – whether or not the network is WiFi
