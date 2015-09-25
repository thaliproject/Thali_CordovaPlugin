/* jshint node: true, undef: true, unused: true  */
'use strict';

var request = require('request');
var tape = require('wrapping-tape');
var identityExchangeEndpoint = require('./thali/identityexchangeendpoint');

// Express
var express = require('express');
var app;
var server;

// Mock Replication Manager
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;

inherits(MockReplicationManager, EventEmitter);
function MockReplicationManager(deviceIdentity, err) {
  EventEmitter.call(this);
  this._deviceIdentity = deviceIdentity;
  this._err = err;
}

MockReplicationManager.prototype.getDeviceIdentity = function (cb) {
  cb(this._err, this._deviceIdentity);
};

var mockIdentityExchangeState;
function resetExchangeState() {
  mockIdentityExchangeState = {
    startIdentityExchangeErr: null,
    stopIdentityExchangeErr: null,
    executeIdentityExchangeErr: null
  };
}

resetExchangeState();

function MockIdentityExchange() {
  this._state = mockIdentityExchangeState;
}

MockIdentityExchange.prototype.startIdentityExchange = function (myFriendlyName, cb) {
  this._state._myFriendlyName = myFriendlyName;
  cb(this._state.startIdentityExchangeErr);
};

MockIdentityExchange.prototype.stopIdentityExchange = function (cb) {
  this._state._stopIdentityExchangeCalled = true;
  cb(this._state.stopIdentityExchangeErr);
};

MockIdentityExchange.prototype.executeIdentityExchange = function (peerIdentifier, otherPkHash, cb) {
  this._state._peerIdentifier = peerIdentifier;
  this._state._otherPkHash = otherPkHash;
  cb(this._state.executeIdentityExchangeErr);
};

MockIdentityExchange.prototype.stopExecutingIdentityExchange = function () {
  this._state.stopExecutingIdentityExchangeCalled = true;
};

// test setup & teardown activities
var test = tape({
  setup: function(t) {
    app = express();
    server = app.listen(3000);
    t.end();
  },
  teardown: function(t) {
    server.close();
    resetExchangeState();
    t.end();
  }
});

test('GET /webview/deviceidentity with invalid entry', function (t) {
  var error = new Error();
  var replicationManager = new MockReplicationManager(null, error);

  var serverPort = 3000,
      dbName = 'thali';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:3000/webview/deviceidentity',
    method: 'GET',
    json: true
  }, function (err, httpResponse, body) {
    t.equal(httpResponse.statusCode, 500, 'Status code should be 500');
    t.equal(body.errorCode, 'E_DEVICEIDNOTSET', 'Error code should be E_DEVICEIDNOTSET');
    t.end();
  });
});

test('GET /webview/deviceidentity with valid entry', function (t) {
  var replicationManager = new MockReplicationManager('thali_device');

  var serverPort = 3000,
      dbName = 'thali';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:3000/webview/deviceidentity',
    method: 'GET',
    json: true
  }, function (err, httpResponse, body) {
    t.equal(httpResponse.statusCode, 200, 'Status code should be 200');
    t.equal(body.deviceIdentity, 'thali_device', 'Device Identity should be thali_device');
    t.end();
  });
});

test('PUT /webview/identityexchange with invalid peer friendly name', function (t) {
  var replicationManager = new MockReplicationManager('thali_device');

  var serverPort = 3000,
      dbName = 'thali';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:3000/webview/identityexchange',
    method: 'PUT',
    json: true
  }, function (err, httpResponse, body) {
    t.equal(httpResponse.statusCode, 400, 'Status code should be 400');
    t.equal(body.errorCode, 'E_PEERFRIENDLYNAMEMISSING', 'Error code should be E_PEERFRIENDLYNAMEMISSING');
    t.equal(mockIdentityExchangeState._myFriendlyName, undefined);
    t.end();
  });
});

test('PUT /webview/identityexchange with valid entry', function (t) {
  var replicationManager = new MockReplicationManager('thali_device');

  var serverPort = 3000,
      dbName = 'thali',
      peerFriendlyName = 'BOB';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:3000/webview/identityexchange',
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');
    t.equal(mockIdentityExchangeState._myFriendlyName, peerFriendlyName, 'Should use myFriendlyName');
    t.end();
  });
});

test('PUT /webview/identityexchange with same name twice', function (t) {
  var replicationManager = new MockReplicationManager('thali_device');

  var serverPort = 3000,
      dbName = 'thali',
      peerFriendlyName = 'BOB';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:3000/webview/identityexchange',
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {

    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');
    t.equal(mockIdentityExchangeState._myFriendlyName, peerFriendlyName, 'Should use myFriendlyName');

    request({
      url: 'http://localhost:3000/webview/identityexchange',
      method: 'PUT',
      json: true,
      body: { peerFriendlyName: peerFriendlyName }
    }, function (err, httpResponse, body) {
      t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
      t.equal(body, 'Created', 'Body should be Created');
      t.equal(mockIdentityExchangeState._myFriendlyName, peerFriendlyName, 'Should use myFriendlyName');
      t.end();
    });

  });
});

test('PUT /webview/identityexchange with different names twice', function (t) {
  var replicationManager = new MockReplicationManager('thali_device');

  var serverPort = 3000,
      dbName = 'thali',
      peerFriendlyName1 = 'BOB',
      peerFriendlyName2 = 'BILL';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:3000/webview/identityexchange',
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName1 }
  }, function (err, httpResponse, body) {

    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');
    t.equal(mockIdentityExchangeState._myFriendlyName, peerFriendlyName1, 'Should use myFriendlyName');

    request({
      url: 'http://localhost:3000/webview/identityexchange',
      method: 'PUT',
      json: true,
      body: { peerFriendlyName: peerFriendlyName2 }
    }, function (err, httpResponse, body) {
      t.equal(httpResponse.statusCode, 400, 'Status code should be 400');
      t.equal(body.errorCode, 'E_INVALIDEXCHANGE', 'Error code should be E_INVALIDEXCHANGE');
      t.end();
    });

  });
});

test('PUT /webview/identityexchange with startIdentityExchange error', function (t) {
  var replicationManager = new MockReplicationManager('thali_device');

  var serverPort = 3000,
      dbName = 'thali',
      peerFriendlyName = 'BOB';

  mockIdentityExchangeState.startIdentityExchangeErr = new Error();

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:3000/webview/identityexchange',
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.equal(httpResponse.statusCode, 500, 'Status code should be 201');
    t.equal(body.errorCode, 'E_STARTIDEXCHANGEFAILED', 'Error code should be E_STARTIDEXCHANGEFAILED');
    t.end();
  });
});

test('DELETE /webview/identityexchange without calling start', function (t) {
  var replicationManager = new MockReplicationManager('thali_device');

  var serverPort = 3000,
      dbName = 'thali';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:3000/webview/identityexchange',
    method: 'DELETE',
    json: true
  }, function (err, httpResponse, body) {
    t.equal(httpResponse.statusCode, 404, 'Status code should be 404');
    t.equal(body.errorCode, 'E_NOCURRENTIDEXCHANGE', 'Error code should be E_NOCURRENTIDEXCHANGE');
    t.end();
  });
});

test('DELETE /webview/identityexchange normal', function (t) {
  var replicationManager = new MockReplicationManager('thali_device');

  var serverPort = 3000,
      dbName = 'thali',
      peerFriendlyName = 'BOB';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:3000/webview/identityexchange',
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');
    t.equal(mockIdentityExchangeState._myFriendlyName, peerFriendlyName, 'Should use myFriendlyName');

    request({
      url: 'http://localhost:3000/webview/identityexchange',
      method: 'DELETE',
      json: true
    }, function (err, httpResponse) {
      t.equal(httpResponse.statusCode, 204, 'Status code should be 204');
      t.end();
    });

  });
});

test('DELETE /webview/identityexchange error', function (t) {
  var replicationManager = new MockReplicationManager('thali_device');

  var serverPort = 3000,
      dbName = 'thali',
      peerFriendlyName = 'BOB';

  mockIdentityExchangeState.stopIdentityExchangeErr = new Error();

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:3000/webview/identityexchange',
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');
    t.equal(mockIdentityExchangeState._myFriendlyName, peerFriendlyName, 'Should use myFriendlyName');

    request({
      url: 'http://localhost:3000/webview/identityexchange',
      method: 'DELETE',
      json: true
    }, function (err, httpResponse, body) {
      t.equal(httpResponse.statusCode, 500, 'Status code should be 500');
      t.equal(body.errorCode, 'E_STOPIDEXCHANGEFAILED', 'Error code should be E_STOPIDEXCHANGEFAILED');
      t.end();
    });

  });
});

test('GET /webview/identityexchange without calling start', function (t) {
  var replicationManager = new MockReplicationManager('thali_device');

  var serverPort = 3000,
      dbName = 'thali';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:3000/webview/identityexchange',
    method: 'GET',
    json: true
  }, function (err, httpResponse, body) {
    t.equal(httpResponse.statusCode, 404, 'Status code should be 404');
    t.equal(body.errorCode, 'E_NOCURRENTIDEXCHANGE', 'Error code should be E_NOCURRENTIDEXCHANGE');
    t.end();
  });
});

test('GET /webview/identityexchange normal', function (t) {
  var replicationManager = new MockReplicationManager('thali_device');

  var serverPort = 3000,
      dbName = 'thali',
      peerFriendlyName = 'BOB';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  replicationManager.emit('peerIdentityExchange', {
    peerIdentifier: 'DEVICE',
    peerName: 'REALLYLONGHASH',
    peerFriendlyName: 'BILL'
  });

  request({
    url: 'http://localhost:3000/webview/identityexchange',
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');
    t.equal(mockIdentityExchangeState._myFriendlyName, peerFriendlyName, 'Should use myFriendlyName');

    request({
      url: 'http://localhost:3000/webview/identityexchange',
      method: 'GET',
      json: true
    }, function (err, httpResponse, body) {
      t.equal(httpResponse.statusCode, 200, 'Status code should be 200');
      t.equal(body.peerFriendlyName, peerFriendlyName, 'Body should have peerFriendlyName');
      t.equal(body.peers[0].peerDeviceId, 'DEVICE', 'Body should have a peer with peer device ID');
      t.equal(body.peers[0].peerPublicKeyHash, 'REALLYLONGHASH', 'Body should have a peer with public key hash');
      t.equal(body.peers[0].peerFriendlyName, 'BILL', 'Body should have a peer with peer friendly name');
      t.end();
    });
  });
});

test('PUT /webview/identityexchange/executeexchange without start', function (t) {
  var replicationManager = new MockReplicationManager('thali_device');

  var serverPort = 3000,
      dbName = 'thali';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:3000/webview/identityexchange/executeexchange',
    method: 'PUT',
    json: true
  }, function (err, httpResponse, body) {
    t.equal(httpResponse.statusCode, 404, 'Status code should be 200');
    t.equal(body.errorCode, 'E_NOCURRENTIDEXCHANGE', 'Error code should be E_NOCURRENTIDEXCHANGE');
    t.end();
  });
});
