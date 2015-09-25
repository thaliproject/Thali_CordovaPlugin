/* jshint node: true, undef: true, unused: true  */
'use strict';

var request = require('request');
var tape = require('../lib/thali-tape');
var identityExchangeEndpoint = require('thali/identityExchange/identityexchangeendpoint');
var ThaliReplicationManager = require('thali/thalireplicationmanager');
var identityExchangeTestUtils = require('./identityExchangeTestUtils');
var IdentityExchange = require('thali/identityExchange/identityexchange');

// Express
var express = require('express');
var dbName = 'thali';
var app;
var server;
var serverPort;
var replicationManager;
var identityExchange;

// Mock Replication Manager
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;

function setUpServer() {
  return identityExchangeTestUtils.createThaliAppServer()
      .then(function(appAndServer) {
        app = appAndServer.app;
        server = appAndServer.server;
        serverPort = server.address().port;
      }).catch(function(err) {
        throw err;
      });
}

// test setup & teardown activities
var test = tape({
  setup: function(t) {
    setUpServer().then(function() {
      if (jxcore.utils.OSInfo().isMobile) {
        var db = identityExchangeTestUtils.LevelDownPouchDB()(dbName);
        replicationManager = new ThaliReplicationManager(db);
        identityExchange = new IdentityExchange(app, serverPort, replicationManager, dbName);
      } else {
        identityExchange = MockIdentityExchange;
        replicationManager = new MockReplicationManager('thali_device');
      }
      t.end();
    });
  },
  teardown: function(t) {
    server.close();
    resetExchangeState();
    t.end();
  }
});

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
    executeIdentityExchangeErr: null,
    verificationCode: 0
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
  cb(this._state.executeIdentityExchangeErr, this._state.verificationCode);
};

MockIdentityExchange.prototype.stopExecutingIdentityExchange = function () {
  this._state.stopExecutingIdentityExchangeCalled = true;
};

test('GET /webview/deviceidentity with invalid entry', function (t) {
  var error = new Error();
  // We have to override the replication manager since we can only produce
  // this error with a mock.
  var replicationManager = new MockReplicationManager(null, error);

  var dbName = 'thali';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:'+serverPort+'/webview/deviceidentity',
    method: 'GET',
    json: true
  }, function (err, httpResponse, body) {
    t.equal(httpResponse.statusCode, 500, 'Status code should be 500');
    t.equal(body.errorCode, 'E_DEVICEIDNOTSET', 'Error code should be E_DEVICEIDNOTSET');
    t.end();
  });
});

test('GET /webview/deviceidentity with valid entry', function (t) {
  replicationManager.getDeviceIdentity(function(err, deviceIdentity) {
    t.notOk(err);
    identityExchangeEndpoint(app, serverPort, dbName, replicationManager, identityExchange);

    request({
      url: 'http://localhost:'+serverPort+'/webview/deviceidentity',
      method: 'GET',
      json: true
    }, function (err, httpResponse, body) {
      t.equal(httpResponse.statusCode, 200, 'Status code should be 200');
      t.equal(body.deviceIdentity, deviceIdentity);
      t.end();
    });
  });
});

test('PUT /webview/identityexchange with invalid peer friendly name', function (t) {
  identityExchange.startIdentityExchange()
  request({
    url: 'http://localhost:'+serverPort+'/webview/identityexchange',
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

  var dbName = 'thali',
      peerFriendlyName = 'BOB';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:'+serverPort+'/webview/identityexchange',
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

  var dbName = 'thali',
      peerFriendlyName = 'BOB';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:'+serverPort+'/webview/identityexchange',
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {

    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');
    t.equal(mockIdentityExchangeState._myFriendlyName, peerFriendlyName, 'Should use myFriendlyName');

    request({
      url: 'http://localhost:'+serverPort+'/webview/identityexchange',
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

  var dbName = 'thali',
      peerFriendlyName1 = 'BOB',
      peerFriendlyName2 = 'BILL';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:'+serverPort+'/webview/identityexchange',
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName1 }
  }, function (err, httpResponse, body) {

    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');
    t.equal(mockIdentityExchangeState._myFriendlyName, peerFriendlyName1, 'Should use myFriendlyName');

    request({
      url: 'http://localhost:'+serverPort+'/webview/identityexchange',
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

  var dbName = 'thali',
      peerFriendlyName = 'BOB';

  mockIdentityExchangeState.startIdentityExchangeErr = new Error();

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:'+serverPort+'/webview/identityexchange',
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

  var dbName = 'thali';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:'+serverPort+'/webview/identityexchange',
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

  var dbName = 'thali',
      peerFriendlyName = 'BOB';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:'+serverPort+'/webview/identityexchange',
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');
    t.equal(mockIdentityExchangeState._myFriendlyName, peerFriendlyName, 'Should use myFriendlyName');

    request({
      url: 'http://localhost:'+serverPort+'/webview/identityexchange',
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

  var dbName = 'thali',
      peerFriendlyName = 'BOB';

  mockIdentityExchangeState.stopIdentityExchangeErr = new Error();

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:'+serverPort+'/webview/identityexchange',
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');
    t.equal(mockIdentityExchangeState._myFriendlyName, peerFriendlyName, 'Should use myFriendlyName');

    request({
      url: 'http://localhost:'+serverPort+'/webview/identityexchange',
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

  var dbName = 'thali';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:'+serverPort+'/webview/identityexchange',
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

  var dbName = 'thali',
      peerFriendlyName = 'BOB';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  replicationManager.emit('peerIdentityExchange', {
    peerIdentifier: 'DEVICE',
    peerName: 'REALLYLONGHASH',
    peerFriendlyName: 'BILL'
  });

  request({
    url: 'http://localhost:'+serverPort+'/webview/identityexchange',
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');
    t.equal(mockIdentityExchangeState._myFriendlyName, peerFriendlyName, 'Should use myFriendlyName');

    request({
      url: 'http://localhost:'+serverPort+'/webview/identityexchange',
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

  var dbName = 'thali';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:'+serverPort+'/webview/identityexchange/executeexchange',
    method: 'PUT',
    json: true
  }, function (err, httpResponse, body) {
    t.equal(httpResponse.statusCode, 404, 'Status code should be 404');
    t.equal(body.errorCode, 'E_NOCURRENTIDEXCHANGE', 'Error code should be E_NOCURRENTIDEXCHANGE');
    t.end();
  });
});

test('PUT /webview/identityexchange/executeexchange peer device missing', function (t) {
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
      url: 'http://localhost:3000/webview/identityexchange/executeexchange',
      method: 'PUT',
      json: true
    }, function (err, httpResponse, body) {
      t.equal(httpResponse.statusCode, 400, 'Status code should be 400');
      t.equal(body.errorCode, 'E_PEERDEVICEIDMISSING', 'Error code should be E_PEERDEVICEIDMISSING');
      t.end();
    });

  });
});

test('PUT /webview/identityexchange/executeexchange no peer found', function (t) {
  var replicationManager = new MockReplicationManager('thali_device');

  var serverPort = 3000,
      dbName = 'thali',
      peerFriendlyName = 'BOB',
      peerDeviceId = 'DEVICEID';

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
      url: 'http://localhost:3000/webview/identityexchange/executeexchange',
      method: 'PUT',
      json: true,
      body: { peerDeviceId: peerDeviceId }
    }, function (err, httpResponse, body) {
      t.equal(httpResponse.statusCode, 400, 'Status code should be 400');
      t.equal(body.errorCode, 'E_PEERDEVICEIDNOTFOUND', 'Error code should be E_PEERDEVICEIDMISSING');
      t.end();
    });

  });
});

test('PUT /webview/identityexchange/executeexchange peer found', function (t) {
  var replicationManager = new MockReplicationManager('thali_device');

  var serverPort = 3000,
      dbName = 'thali',
      peerFriendlyName = 'BOB',
      peerDeviceId = 'DEVICEID';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  replicationManager.emit('peerIdentityExchange', {
    peerIdentifier: peerDeviceId,
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
      url: 'http://localhost:3000/webview/identityexchange/executeexchange',
      method: 'PUT',
      json: true,
      body: { peerDeviceId: peerDeviceId }
    }, function (err, httpResponse, body) {
      t.equal(httpResponse.statusCode, 202, 'Status code should be 202');
      t.equal(body, 'Accepted', 'Body should be accepted');
      t.end();
    });

  });
});

test('PUT /webview/identityexchange/executeexchange different peers', function (t) {
  var replicationManager = new MockReplicationManager('thali_device');

  var serverPort = 3000,
      dbName = 'thali',
      peerFriendlyName = 'BOB',
      peerDeviceId1 = 'DEVICEID1',
      peerDeviceId2 = 'DEVICEID2';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  replicationManager.emit('peerIdentityExchange', {
    peerIdentifier: peerDeviceId1,
    peerName: 'REALLYLONGHASH',
    peerFriendlyName: 'BILL'
  });

  replicationManager.emit('peerIdentityExchange', {
    peerIdentifier: peerDeviceId2,
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
      url: 'http://localhost:3000/webview/identityexchange/executeexchange',
      method: 'PUT',
      json: true,
      body: { peerDeviceId: peerDeviceId1 }
    }, function (err, httpResponse, body) {
      t.equal(httpResponse.statusCode, 202, 'Status code should be 202');
      t.equal(body, 'Accepted', 'Body should be accepted');

      request({
        url: 'http://localhost:3000/webview/identityexchange/executeexchange',
        method: 'PUT',
        json: true,
        body: { peerDeviceId: peerDeviceId2 }
      }, function (err, httpResponse, body) {
        t.equal(httpResponse.statusCode, 400, 'Status code should be 400');
        t.equal(body.errorCode, 'E_INVALIDEXCHANGE', 'Error code should be E_INVALIDEXCHANGE');
        t.end();
      });
    });
  });
});

test('GET /webview/identityexchange/executeexchange peer found', function (t) {
  var replicationManager = new MockReplicationManager('thali_device');

  var serverPort = 3000,
      dbName = 'thali',
      peerFriendlyName = 'BOB',
      peerDeviceId = 'DEVICEID';

  mockIdentityExchangeState.verificationCode = 12345;

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  replicationManager.emit('peerIdentityExchange', {
    peerIdentifier: peerDeviceId,
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
      url: 'http://localhost:3000/webview/identityexchange/executeexchange',
      method: 'PUT',
      json: true,
      body: { peerDeviceId: peerDeviceId }
    }, function (err, httpResponse, body) {
      t.equal(httpResponse.statusCode, 202, 'Status code should be 202');
      t.equal(body, 'Accepted', 'Body should be accepted');

      request({
        url: 'http://localhost:3000/webview/identityexchange/executeexchange',
        method: 'GET',
        json: true,
      }, function (err, httpResponse, body) {
        t.equal(httpResponse.statusCode, 200, 'Status code should be 200');
        t.equal(body.status, 'complete', 'Status should be complete');
        t.equal(body.verificationCode, 12345, 'Verification code be present');
        t.equal(body.peerDeviceId, peerDeviceId, 'Peer device ID should be present');
        t.equal(body.publicKeyHash, 'REALLYLONGHASH', 'Public key hash should be present');
        t.end();
      });
    });
  });
});

test('GET /webview/identityexchange/executeexchange error', function (t) {
  var replicationManager = new MockReplicationManager('thali_device');

  var serverPort = 3000,
      dbName = 'thali',
      peerFriendlyName = 'BOB',
      peerDeviceId = 'DEVICEID';

  mockIdentityExchangeState.executeIdentityExchangeErr = new Error();

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  replicationManager.emit('peerIdentityExchange', {
    peerIdentifier: peerDeviceId,
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
      url: 'http://localhost:3000/webview/identityexchange/executeexchange',
      method: 'PUT',
      json: true,
      body: { peerDeviceId: peerDeviceId }
    }, function (err, httpResponse, body) {
      t.equal(httpResponse.statusCode, 202, 'Status code should be 202');
      t.equal(body, 'Accepted', 'Body should be accepted');

      request({
        url: 'http://localhost:3000/webview/identityexchange/executeexchange',
        method: 'GET',
        json: true,
      }, function (err, httpResponse, body) {
        t.equal(httpResponse.statusCode, 500, 'Status code should be 500');
        t.equal(body.status, 'error', 'Status should be complete');
        t.equal(body.errorCode, 'E_STARTEXECUTEIDEXCHANGEFAILED', 'Error code should be E_STARTEXECUTEIDEXCHANGEFAILED');
        t.end();
      });
    });
  });
});

test('DELETE /webview/deviceidentity with valid entry', function (t) {
  var replicationManager = new MockReplicationManager('thali_device');

  var serverPort = 3000,
      dbName = 'thali';

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  request({
    url: 'http://localhost:3000/webview/identityexchange/executeexchange',
    method: 'DELETE',
    json: true
  }, function (err, httpResponse, body) {
    t.equal(httpResponse.statusCode, 404, 'Status code should be 200');
    t.equal(body.errorCode, 'E_NOCURRENTIDEXCHANGE', 'Error code should be E_NOCURRENTIDEXCHANGE');
    t.end();
  });
});

test('GET /webview/identityexchange/executeexchange peer found', function (t) {
  var replicationManager = new MockReplicationManager('thali_device');

  var serverPort = 3000,
      dbName = 'thali',
      peerFriendlyName = 'BOB',
      peerDeviceId = 'DEVICEID';

  mockIdentityExchangeState.verificationCode = 12345;

  identityExchangeEndpoint(app, serverPort, dbName, replicationManager, MockIdentityExchange);

  replicationManager.emit('peerIdentityExchange', {
    peerIdentifier: peerDeviceId,
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
      url: 'http://localhost:3000/webview/identityexchange/executeexchange',
      method: 'PUT',
      json: true,
      body: { peerDeviceId: peerDeviceId }
    }, function (err, httpResponse, body) {
      t.equal(httpResponse.statusCode, 202, 'Status code should be 202');
      t.equal(body, 'Accepted', 'Body should be accepted');

      request({
        url: 'http://localhost:3000/webview/identityexchange/executeexchange',
        method: 'DELETE',
        json: true,
      }, function (err, httpResponse, body) {
        t.equal(httpResponse.statusCode, 204, 'Status code should be 204');
        t.end();
      });
    });
  });
});
