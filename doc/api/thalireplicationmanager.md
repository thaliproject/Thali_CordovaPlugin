# The `ThaliReplicationManager` class

The `ThaliReplicationManager` class handles database replication between devices, using [PouchDB](http://pouchdb.com/) and the Thali Cordova bridge `ThaliEmitter` class.

## Usage

This is the basic usage to start the replication manager.

```js
var PouchDB = require('pouchdb');
var db = new PouchDB('dbname');

var manager = new ThaliReplicationManager(db);

manager.start(function (err) {
  if (err) {
    console.log(err);
  } else {
    console.log('Started the replication manager');

    // Stop it after 5 seconds
    setTimeout(function () {
      manager.stop(function (err) {
        if (err) {
          console.log('err');
        } else {
          console.log('Stopped the replication manager');
        }
      })
    }, 5000);
  }
});
```

## `ThaliReplicationManager(db)` constructor

Creates a new instance of the `ThaliReplicationManager` class with a PouchDB instance.

#### Arguments:
1. `db` : `PouchDB` - a PouchDB instance used for synchronization across devices.

#### Example:

```js
var PouchDB = require('pouchdb');
var db = new PouchDB('dbname');

var manager = new ThaliReplicationManager(db);
```
***

## Methods

### `ThaliReplicationManager.prototype.start(callback)`

This method starts the Thali Replication Manager.

#### Arguments:

1. `callback` : `Function` – must be in the form of the following, `function (err)` where:
  - `err` : `Error` – an `Error` if one occurred, else `null`

#### Example:

```js
manager.start(function (err) {
  if (err) {
    console.log(err);
  } else {
    console.log('Thali replication manager started');
  }
});
```
***

### `ThaliEmitter.prototype.stop(callback)`

This method stops the Thali Replication Manager.

#### Arguments:

1. `callback` : `Function` – must be in the form of the following, function (err) where:
  - `err` : `Error` – an `Error` if one occurred, else `null`

#### Example:

```js
manager.start(function (err) {
  if (err) {
    console.log(err);
  } else {
    console.log('Started the replication manager');

    // Stop it after 5 seconds
    setTimeout(function () {
      manager.stop(function (err) {
        if (err) {
          console.log('err');
        } else {
          console.log('Stopped the replication manager');
        }
      })
    }, 5000);
  }
});
```
