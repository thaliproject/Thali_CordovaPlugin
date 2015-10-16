# The `Mobile API` class

The `Mobile API` class is a set of Javascript functions that use JXcore's native call out capabilities to talk
to the underlying native platform and use its non-TCP/IP based technologies to enable discovery and connectivity
to devices. However, to enable better interop with Node's rich collection of TCP/IP based stacks all connections
over non-TCP/IP native technologies will be bridged to TCP/IP.

Note that callbacks rather than promises are specified below because that is required by the JXcore native API. But
it is expected that the `Mobile API` will itself be wrapped by a similar but higher level API that will encompass
additional functionality such as TCP/IP (and UDP/IP) based discovery/connectivity. That API will use promises.

## Usage

## API

MobileAPI is a singleton so there is no constructor. It exposes the following methods:

- `Mobile('StartListening').callNative(portNumber, callback)`
- `Mobile('StopListening').callNative(callback)`
- `Mobile('StartUpdateAdvertising').callNative(callback)`
- `Mobile('StopAdvertising').callNative(callback)`
- `Mobile('Connect').callNative(peerIdentifier, callback)`
- `Mobile('Disconnect').callNative(peerIdentifier, callback)`
- `Mobile('NetworkStatus').callNative(callback)`

## Events
- `Mobile('NetworkChanged').registerToNative(callback)`
- `Mobile('PeerAvailabilityChanged').registerToNative(callback)`

## Methods

### Rules that apply to all methods

All methods defined here are asynchronous. This means that when called they synchronously will return null and the
actual response will be sent to the submitted callback.

Unless explicitly stated otherwise in a method's definition, all methods defined here are safe to call consecutively 
but not concurrently.

In other words:

```js
emitter.startListening(portNumber, function() {});
emitter.startListening(portNumber + 1, function() {});
```

is an error because it has two calls to startListening outstanding at the same time without waiting for the callback.

For methods that do not support concurrent calls the system should do its best to return a 'NoConcurrentCalls' 
error message. But in general if any method is called concurrently that does not support concurrent calls then the 
system is said to be in an indeterminate state and operations should not continue.

Where as:

```js
emitter.startListening(portNumber, function(err) {
  if (err) {
    throw err;
  }
  emitter.startListening(portNumber + 1, function() {});
});
```

is explicitly allowed because while the calls to startListening are consecutive they are not concurrent.

### `Mobile('StartListening').callNative(portNumber, callback)`

This method instructs the native layer to do two things. 

First, it tells the native layer to discovery what other devices are within range using whatever non-TCP/IP native 
technologies are available. When a device is discovered its information will be published as a 
`peerAvailabilityChanged` event.

Second, it tells the native layer to accept incoming connections over the non-TCP/IP native technologies and to bridge
those connections to TCP/IP and then connect to the submitted portNumber on 127.0.0.1.

In theory this function could be split into two methods but in practice that separation is not always meaningful. For
example, in Android we perform discovery with BLE and accept incoming connections over Bluetooth. So a separation is
theoretically possible. But in iOS we use the multi-peer connectivity framework for both discovery and connectivity
so the separation is not meaningful. So for now our resolution to this issue is to combine both discovering and
listening for connections into a single method call.

__Note:__ When we make this library more generic we should accept an array of service types to look for, but for now
we are going to hard code in Thali's service type. This is mostly to save us testing effort. If we don't need the
feature yet, then let's add it in later.

When another device connects to this device over the non-TCP/IP based native technology the native layer will create
a local TCP/IP client who will connect to 127.0.0.1 using the supplied portNumber. This will make the remote device
look to the local Node.js code as if it were talking over TCP/IP. But this is just a bridge from the non-TCP/IP
native technology to TCP/IP.

When calling this method consecutively it is fine to use different portNumbers on each call. Calling
the method consecutively tells the native layer to just keep on listening and keep on accepting incoming
connections. There must not be any disruption in listening or accepting incoming connections due to consecutive calls
to this method. If the portNumber is changed between calls then this change only affects future incoming connections,
any existing connections on the old portNumber must be left alone. For example, imagine that at time 0 `StartListening` 
is called with port A, a time 1 an incoming connection is received and connected to port A, a time 2 'StartListening' is
called again but with port B. From time 2 onwards any new incoming connections will be connected to port B but the
existing incoming connection to port A will be left alone.

It is an error to concurrently call startListening and stopListening. Any attempt to do so leaves the system in
an indeterminate state. Ideally however one or both calls would fail with a 'NoConcurrentCalls' error but this is
not guaranteed.

#### Arguments:

1. `portNumber` : `Number` - the 127.0.0.1 TCP/IP port number to forward requests to
2. `callback` : `Function` - must be in the form of the following, `function(err)` where:
  - `err` : `Error` - an `Error` if one occurred, else `null`.

### `Mobile('StopListening').callNative(callback)`

This method instructs the native layer to stop listening for discovery requests and incoming connections. It also
instructs the native layer to terminate any in-progress incoming connections regardless of what port they are
directed to.

For example, if startListening was called with portNumber A and then later called with portNumber B resulting in
incoming connections to both port A and B when `stopListening()` is called all connections, both to ports A and B,
are to be terminated.

Once this method calls the submitted callback no further `peerAvailabilityChanged` events will be received until 
`startListening()` is called.

`stopListening()` may be called successfully at any time, even if `startListening()` has not been called.

`stopListening()` is idempotent so multiple concurrent calls will not cause any state changes.

#### Arguments:
1. `callback` : `Function` - must be in the form of the following, `function(err)` where:
  - `err` : `Error` - an `Error` if one occurred, else `null`.

### `Mobile('StartUpdateAdvertising').callNative(callback)`

This method tells the native layer to start advertising the device's support of Thali.

_Note:_ When we release this as a generic library we should take an argument to specify what type of service to 
advertise. But for now we will just hardcode in Thali's service identifier.

An issue Thali has to deal with is that its discovery layer is based on a fairly long string of data (see 
[here](http://thaliproject.org/presenceprotocolforopportunisticsynching) for details). This string is typically
too long to reliably send over native discovery mechanisms. So instead we do a 'two step' where we just advertise
our support of Thali over the local discovery mechanism and then we establish a connection directly to the
device over the local high bandwidth transport to get the discovery string. 

The problem is that the discovery string changes over time so how is device A who discovered device B supposed to know 
that two minutes later device B has a different discovery string? In other words, at time 0 device A retrieves device 
B's discovery string and takes whatever actions are appropriate with it. At time 1 device B changes 
its discovery string, device A now needs to know to look at the new discovery string. How is device A supposed to find 
out? After all it has already discovered device B. Why would it try to talk to device B again?

We could, of course, use polling. But that is not battery efficient.

Instead we use different solutions for different platforms, see the document `discoveryNotification.md` for details on 
how this is handled for different platforms. But in each case the native code needs a signal that a new string is 
available. This method provides that signal.

In iOS however multi-peer connectivity works slightly differently. There we have to create a new session. But 
conceptually the result is the same. The new session has a new piece of metadata that tells everybody that
something has changed.

This all brings us to the second purpose of this method (and to its odd name). `startUpdateAdvertising()` is to
be called when a discovery string is available (note that the discovery string is handled at the node.js layer
and so isn't passed to the native layer). But it is also to be called whenever that string changes. This tells the
native layer to do whatever is required to notify everyone that a new discovery string is available.

`startUpdateAdvertising()` is not idempotent since each consecutive call causes a state change to occur but regardless
concurrent calls are explicitly legal.

`startUpdateAdvertising()` must not be called unless `startListening()` has successfully called its callback and the
system is in the listening state. If `startUpdateAdvertising()` is
called with `startListening()` is not active then a `OnlyCallAfterStartListening` error message must be returned.

#### Arguments:
1. `callback` : `Function` - must be in the form of the following, `function(err)` where:
  - `err` : `Error` - an `Error` if one occurred, else `null`.

### `Mobile('StopAdvertising').callNative(callback)`

This method tells the native layer to stop advertising support for Thali. It only affects advertising, not listening
or any connections.

`stopAdvertising()` may be called successfully at any time, even if `startUpdateAdvertising()` or `startListening()` 
have not been called.

`stopAdvertising()` is idempotent.

#### Arguments
1. `callback` : `Function` - must be in the form of the following, `function(err)` where:
  - `err` : `Error` - an `Error` if one occurred, else `null`.
  
### `Mobile('Connect').callNative(peerIdentifier, callback)`

As explained in more detail in the section on `peerAvailabilityChanged` when a peer is discovered via the native
layer it is assigned a `peerIdentifier`. Since the peer is not natively available over TCP/IP we have to
do some setup work to create the appearance of a TCP/IP connection. That is what the connect method is for.
It tells the native layer that the node.js code wants to establish a TCP/IP connection to the peer identified
by the `peerIdentifier`. 

The native layer will attempt to create a connection to the peer using the native non-TCP/IP technology. If the
connection fails then the callback will be called with a 'FailedToEstablishConnection' error message.

If the native connection can be created then the native layer will create a local TCP/IP listener on 127.0.0.1. The
port the listener is on will be returned in the callback. The node.js code can then open connections to the returned
TCP/IP port. Any bytes sent on that port will be forwarded to the identifier peer and any bytes received will be
returned from that port. This creates what looks like a TCP/IP connection to the peer but in fact is just a bridge
to the native layer non-TCP/IP technology.

At any one time the native layer will accept exactly one incoming TCP/IP connection to the returned port. An attempt
to created additional connections must fail at the TCP/IP layer (e.g. connection refused). The reason for limiting
the number of connections to one is that we do not provide any kind of multiplexing at the native layer (that will
instead be provided in node.js directly). So if multiple TCP/IP connections were opened to the native port then
it would cause confusion as to which bytes belong to which connection.

Once a successful response to a connect call is returned with a port that port must be associated with the associated
peer until disconnect is called (and only disconnect, none of the other methods like stopListening are relevant).

If the underlying non-TCP/IP connection fails for any reason then the connection to the TCP/IP port must be 
immediately terminated. This is necessary to prevent situations where state can get hopelessly confused. It is
possible, for example, for one side of a connection to think the non-TCP/IP connection has failed while the other
side never knew there was a problem. In that case one side starts what it thinks is a new stream and the other
side thinks it is continuing the old stream. This will cause data corruption.

If the node.js layer terminates its TCP/IP connection to the local port for any reason then the native non-TCP/IP
connection must be torn down completely. This is for the same stream confusion reasons as stated above.

After disconnecting from the local port the node.js layer is free to create a new connection to the local port
and thus cause the native layer to create a new native non-TCP/IP connection. But again, there can only be a single
connection outstanding on the local port at a time.

Note that in some environments (iOS) it is impossible to guarantee ownership of a port across events like being
put in the background. In those cases when the application comes back to the foreground it will have lost all 
the ports it had held onto. As a result applications must, in practice, be prepared for the association between
a port and a particular peer to be broken at any time. This is known as the channel binding problem. The device
thinks that peer A is available on port B but in fact due to any number of events port B could be out of use or
worse be assigned to a completely different peer. Thali normally deals with this problem by using TLS on all of its
connections. This guarantees that we always are talking to who we think we are talking to and thus obviates the
channel binding problem at this layer. But in some cases, especially discovery, we cannot use TLS and therefore
we instead must provide information about the caller inside of the message. This is inherent, for example, to the
Thali notification mechanism and has its own cryptographic guarantees. But even with TLS one must always be
ready to receive a handshake error.

In the case of a TLS handshake error or similar channel binding problem indicator the node.js code must call 
disconnect in order to clear state and then call connect again on that peer in order to get a new port.

Unlike other methods on this object `connect()` can be called concurrently if and only if different `peerIdentifier`
values are used. If an attempt is made to call `connect()` concurrently with the same `peerIdentifier` then the
system MUST fail all but one of the connect calls with `NoConcurrentCallsWithSamePeerIdentifier` error message. If
consecutive calls are made to `connect()` with the same `peerIdentifier` then the same port must be returned
to all callbacks. Of course the the 'one connection to the local port' rule still applies so only one of those
concurrent callers is going to be able to successfully connect to the local port.

#### Arguments:

1. `peerIdentifier` : `String` – peer identifier found during the `peerAvailabilityChanged` event.
2. `callback` : `Function` – must be in the form of the following, `function (err, port)` where:
    - `err` : `Error` – an `Error` if one occurred, else `null`
    - `port` : `Number` – the port to connect to the other server for PouchDB synchronization, e.g. `5678` so that we can synchronize to `http://localhost:5678/dbname`
