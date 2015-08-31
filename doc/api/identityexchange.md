# `IdentityExchange` Node Module #

This module implements the [Coin Flipping for Thali Identity Exchange Protocol](http://www.goland.org/coinflippingforthali/) to allow users of Thali to securely exchange identification information.  Note that only one identity exchange can be done at a time and trying to exchange more than one identity at a time will result in an error.

## Usage ##

This is the basic usage of the `IdentityExchange` module.

```js
// Express
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

// parse application/json
app.use(bodyParser.json());

app.listen(5000);

// Thali
var ThaliReplicationManager = require('thali/thalireplicationmanager');
var replicationManager = new ThaliReplicationManager();

// Identity information
var myFriendlyName = '...';
var myPkHash = '...';

var identityExchange = require('thali/identityexchange')(app, replicationManager);

replicationManager.once('peerIdentityExchange', function (peer) {
  // Advertise my friendly name to the world
  identityexchange.startIdentityExchange(myFriendlyName, function (err) {
    if (err) {
      throw err;
    }

    identityExchange.executeIdentityExchange(
      peer.peerIdentifier,
      myPkHash,
      peer.peerName,
      function (err, number) {
        if (err) {
          throw err;
        }

        // Alert the user of the six digit number from the other side
        console.log('Six digit code is %d', number);

        identityExchange.stopIdentityExchange(function (err) {
          if (err) {
            throw err;
          }

          console.log('Identity exchange complete');
        });
      })
  });
});
```

## `IdentityExchange` Methods ##

The `IdentityExchange` module has the following methods:
- `constructor(app, replicationManager)`
- `startIdentityExchange(myFriendlyName, cb)`
- `stopIdentityExchange(cb)`
- `executeIdentityExchange(peerIdentifier, otherPkHash, myPkHash, cb)`

### `constructor(app, replicationManager)`

This constructs the `IdentityExchange` module with an [Express](http://expressjs.com/) application that can have the identity endpoints added to it, as well as a [`ThaliReplicationManager`](thalireplicationmanager.md) instance which is used to broadcast our friendly name and hash for identity exchange.  The Express app must have [body-parser](https://github.com/expressjs/body-parser) module installed as middleware as the identity exchange module will add endpoints which require POST commands with JSON bodies.

#### Arguments
1. `app`: `express` - Express application configured with the body-parser module.
2. `replicationManager`: `ThaliReplicationManager` - a `ThaliReplicationManager` instance used for replicating data betwen devices.

#### Return Value
`IdentityExchange` - the initialized `IdentityExchange` module used for identity exchange between devices.

#### Example
```js
// Express
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

// parse application/json
app.use(bodyParser.json());

app.listen(5000);

// Thali
var ThaliReplicationManager = require('thali/thalireplicationmanager');
var replicationManager = new ThaliReplicationManager();

var identityExchange = require('thali/identityexchange')(app, replicationManager);
```

***

### `startIdentityExchange(myFriendlyName, cb)`

This method starts the identity exchange with a given friendly name to broadcast to other devices.

#### Arguments
1. `myFriendlyName`: `string` - The friendly name to broadcast to other devices as the identity of the device.
2. `callback`: `Function` – must be in the form of the following, `function (err)` where:
  - `err` : `Error` – an `Error` if one occurred, else `null`

#### Example
```js
// Express
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

// parse application/json
app.use(bodyParser.json());

app.listen(5000);

// Thali
var ThaliReplicationManager = require('thali/thalireplicationmanager');
var replicationManager = new ThaliReplicationManager();

var identityExchange = require('thali/identityexchange')(app, replicationManager);

// Advertise my name
var myFriendlyName = '...';

identityExchange.startIdentityExchange(myFriendlyName, function (err) {
  if (err) {
    throw err;
  }

  console.log('Started broadcasting my name as %s', myFriendlyName);
});
```
***

### `stopIdentityExchange(cb)`

This method stops the identity exchange between two devices.

#### Arguments
1. `callback`: `Function` – must be in the form of the following, `function (err)` where:
  - `err` : `Error` – an `Error` if one occurred, else `null`

#### Example
```js
// Express
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

// parse application/json
app.use(bodyParser.json());

app.listen(5000);

// Thali
var ThaliReplicationManager = require('thali/thalireplicationmanager');
var replicationManager = new ThaliReplicationManager();

var identityExchange = require('thali/identityexchange')(app, replicationManager);

// Advertise my name
var myFriendlyName = '...';

identityExchange.startIdentityExchange(myFriendlyName, function (err) {
  if (err) {
    throw err;
  }

  console.log('Started broadcasting my name as %s', myFriendlyName);

  identityExchange.stopIdentityExchange(function (err) {
    if (err) {
      throw err;
    }

    console.log('Stopped broadcasting my name as %s', myFriendlyName);
  });
});
```
***

### `executeIdentityExchange(peerIdentifier, otherPkHash, myPkHash, cb)`

This method stops the identity exchange between two devices.

#### Arguments
1. `peerIdentifier`: `String` - the peer identifier of the remote device to connect to.
2. `otherPkHash`: `String` - the primary key hash for the other device to connect to.
3. `myPkHash`: `String` - the primary key hash for the current device.
4. `callback`: `Function` – must be in the form of the following, `function (err, number)` where:
  - `number`: `Number` - a six digit number used for verifying the identity
  - `err`: `Error` – an `Error` if one occurred, else `null`

#### Example
```js
// Express
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

// parse application/json
app.use(bodyParser.json());

app.listen(5000);

// Thali
var ThaliReplicationManager = require('thali/thalireplicationmanager');
var replicationManager = new ThaliReplicationManager();

var identityExchange = require('thali/identityexchange')(app, replicationManager);

// Advertise my name
var myFriendlyName = '...';

identityExchange.startIdentityExchange(myFriendlyName, function (err) {
  if (err) {
    throw err;
  }

  console.log('Started broadcasting my name as %s', myFriendlyName);

  // Execute identity exchange with other discovered peer
  identityExchange.executeIdentityExchange(otherPeer, myPkHash, otherPkHash, function (err, number) {
    if (err) {
      throw err;
    }

    console.log('Six digit verification number is %d', number);
  });
});
```
***
