/* jshint node: true, undef: true, unused: true  */
'use strict';

return;

var http = require('http');
var request = require('request');
var requestPromise = require('request-promise');
var tape = require('../lib/thaliTape');
var identityExchangeEndpoint = require('thali/identityExchange/identityexchangeendpoint');
var ThaliReplicationManager = require('thali/thalireplicationmanager');
var identityExchangeTestUtils = require('./identityExchangeTestUtils');
var identityExchangeUtils = require('thali/identityExchange/identityExchangeUtils');
var IdentityExchange = require('thali/identityExchange/identityexchange');
var Promise = require('lie');

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
      console.log("serverPort is " + serverPort);
    }).catch(function(err) {
      throw err;
    });
}

// test setup & teardown activities
var test = tape({
  setup: function(t) {
    setUpServer().then(function() {
      server.on('error', function(err) {
        t.pass(("Server emitted an error event - " + JSON.stringify(err));
      });
      if (jxcore.utils.OSInfo().isMobile) {
        var levelDownPouchDb = identityExchangeTestUtils.LevelDownPouchDB();
        var db = new levelDownPouchDb(dbName);
        replicationManager = new ThaliReplicationManager(db);
        identityExchange = new IdentityExchange(app, serverPort, replicationManager, dbName);
      } else {
        identityExchange = new MockIdentityExchange();
        replicationManager = new MockReplicationManager('thali_device');
      }
      t.end();
    });
  },
  teardown: function(t) {
    console.log("Entered teardown section and server value is " + server);
    Object.keys(http.globalAgent.sockets).forEach(function(socketIndex) {
      http.globalAgent.sockets[socketIndex].forEach(function(socket) {
        socket.destroy();
      })
    });
    resetExchangeState();
    new Promise(function (resolve, reject) {
      console.log("Entered first promise");
      if (replicationManager instanceof  ThaliReplicationManager && replicationManager._isStarted) {
        console.log("Calling stopThaliReplicationManager");
        // I really should be able to return stopThaliReplicationManager directly but I've run into
        // some odd issues and this work around seems to work for the moment.
        identityExchangeUtils.stopThaliReplicationManager(replicationManager).
          then(function() {
            console.log("About to call resolve in testIdentityExchangeEndpoint");
            resolve();
          }).catch(function(err) {
            console.log("About to call reject in testIdentityExchangeEndpoint");
            reject(err);
          });
      } else {
        console.log("Calling resolve.");
        return resolve();
      }
    }).then(function () {
        if (server) {
          console.log("About to call server.close");
          server.close();
          t.end();
        } else {
          console.log("Server was null so just ending");
          t.end();
        }
      })
      .catch(function (err) {
        t.fail("stopThaliReplicationManager failed with " + JSON.stringify(err));
        t.end();
      });
  }
});

function MockReplicationManager(deviceIdentity, err) {
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

inherits(MockIdentityExchange, EventEmitter);
function MockIdentityExchange() {
  EventEmitter.call(this);
  this._state = mockIdentityExchangeState;
}

MockIdentityExchange.Events = IdentityExchange.Events;

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

function webviewDeviceIdentityURL() {
  return 'http://localhost:'+serverPort+'/webview/deviceidentity';
}

function webviewIdentityExchangeURL() {
  return 'http://localhost:'+serverPort+'/webview/identityexchange';
}

function webviewIdentityExchangeExecuteExchangeURL() {
  return 'http://localhost:'+serverPort+'/webview/identityexchange/executeexchange';
}

test('GET /webview/deviceidentity with invalid entry', function (t) {
  var error = new Error();
  // We have to override the replication manager since we can only produce
  // this error with a mock.
  replicationManager = new MockReplicationManager(null, error);
  identityExchange = new MockIdentityExchange();

  identityExchangeEndpoint(app, replicationManager, identityExchange);

  request({
    url: webviewDeviceIdentityURL(),
    method: 'GET',
    json: true
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 500, 'Status code should be 500');
    t.equal(body.errorCode, 'E_DEVICEIDNOTSET', 'Error code should be E_DEVICEIDNOTSET');
    t.end();
  });
});

test('GET /webview/deviceidentity with valid entry', function (t) {
  replicationManager.getDeviceIdentity(function(err, deviceIdentity) {
    t.notOk(err);
    identityExchangeEndpoint(app, replicationManager, identityExchange);

    request({
      url: webviewDeviceIdentityURL(),
      method: 'GET',
      json: true
    }, function (err, httpResponse, body) {
      t.notOk(err);
      t.equal(httpResponse.statusCode, 200, 'Status code should be 200');
      t.equal(body.deviceIdentity, deviceIdentity);
      t.end();
    });
  });
});

test('PUT /webview/identityexchange with invalid peer friendly name', function (t) {
  identityExchangeEndpoint(app, replicationManager, identityExchange);
  request({
    url: webviewIdentityExchangeURL(),
    method: 'PUT',
    json: true
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 400, 'Status code should be 400');
    t.equal(body.errorCode, 'E_PEERFRIENDLYNAMEMISSING', 'Error code should be E_PEERFRIENDLYNAMEMISSING');
    t.end();
  });
});

test('PUT /webview/identityexchange with valid entry', function (t) {
  var peerFriendlyName = 'BOB';

  identityExchangeEndpoint(app, replicationManager, identityExchange);

  request({
    url: webviewIdentityExchangeURL(),
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');
    t.end();
  });
});

test('PUT /webview/identityexchange with same name twice', function (t) {
  var peerFriendlyName = 'BOB';

  identityExchangeEndpoint(app, replicationManager, identityExchange);

  request({
    url: webviewIdentityExchangeURL(),
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.notOk(err, "PUT on /webview/identityexchange");
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created - first request');

    request({
      url: webviewIdentityExchangeURL(),
      method: 'PUT',
      json: true,
      body: { peerFriendlyName: peerFriendlyName }
    }, function (err, httpResponse, body) {
      t.notOk(err, "PUT on /webview/identityexchange - second request");
      t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
      t.equal(body, 'Created', 'Body should be Created');
      t.end();
    });

  });
});

test('PUT /webview/identityexchange with different names twice', function (t) {
  var peerFriendlyName1 = 'BOB',
    peerFriendlyName2 = 'BILL';

  identityExchangeEndpoint(app, replicationManager, identityExchange);

  request({
    url: webviewIdentityExchangeURL(),
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName1 }
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');

    request({
      url: webviewIdentityExchangeURL(),
      method: 'PUT',
      json: true,
      body: { peerFriendlyName: peerFriendlyName2 }
    }, function (err, httpResponse, body) {
      t.notOk(err);
      t.equal(httpResponse.statusCode, 400, 'Status code should be 400');
      t.equal(body.errorCode, 'E_INVALIDEXCHANGE', 'Error code should be E_INVALIDEXCHANGE');
      t.end();
    });

  });
});

test('PUT /webview/identityexchange with startIdentityExchange error', function (t) {
  var peerFriendlyName = 'BOB';

  mockIdentityExchangeState.startIdentityExchangeErr = new Error();

  replicationManager = new MockReplicationManager();
  identityExchange = new MockIdentityExchange();
  identityExchangeEndpoint(app, replicationManager, identityExchange);

  request({
    url: webviewIdentityExchangeURL(),
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 500, 'Status code should be 201');
    t.equal(body.errorCode, 'E_STARTIDEXCHANGEFAILED', 'Error code should be E_STARTIDEXCHANGEFAILED');
    t.end();
  });
});

test('DELETE /webview/identityexchange without calling start', function (t) {
  identityExchangeEndpoint(app, replicationManager, identityExchange);

  request({
    url: webviewIdentityExchangeURL(),
    method: 'DELETE',
    json: true
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 404, 'Status code should be 404');
    t.equal(body.errorCode, 'E_NOCURRENTIDEXCHANGE', 'Error code should be E_NOCURRENTIDEXCHANGE');
    t.end();
  });
});

test('DELETE /webview/identityexchange normal', function (t) {
  var peerFriendlyName = 'BOB';

  identityExchangeEndpoint(app, replicationManager, identityExchange);

  request({
    url: webviewIdentityExchangeURL(),
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');

    request({
      url: webviewIdentityExchangeURL(),
      method: 'DELETE',
      json: true
    }, function (err, httpResponse) {
      t.notOk(err);
      t.equal(httpResponse.statusCode, 204, 'Status code should be 204');
      t.end();
    });

  });
});

test('DELETE /webview/identityexchange error', function (t) {
  var peerFriendlyName = 'BOB';

  mockIdentityExchangeState.stopIdentityExchangeErr = new Error();

  replicationManager = new MockReplicationManager();
  identityExchange = new MockIdentityExchange();

  identityExchangeEndpoint(app, replicationManager, identityExchange);

  request({
    url: webviewIdentityExchangeURL(),
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');
    t.equal(mockIdentityExchangeState._myFriendlyName, peerFriendlyName, 'Should use myFriendlyName');

    request({
      url: webviewIdentityExchangeURL(),
      method: 'DELETE',
      json: true
    }, function (err, httpResponse, body) {
      t.notOk(err);
      t.equal(httpResponse.statusCode, 500, 'Status code should be 500');
      t.equal(body.errorCode, 'E_STOPIDEXCHANGEFAILED', 'Error code should be E_STOPIDEXCHANGEFAILED');
      t.end();
    });

  });
});

test('GET /webview/identityexchange without calling start', function (t) {
  identityExchangeEndpoint(app, replicationManager, identityExchange);

  request({
    url: webviewIdentityExchangeURL(),
    method: 'GET',
    json: true
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 404, 'Status code should be 404');
    t.equal(body.errorCode, 'E_NOCURRENTIDEXCHANGE', 'Error code should be E_NOCURRENTIDEXCHANGE');
    t.end();
  });
});

test('GET /webview/identityexchange normal', function (t) {
  var peerFriendlyName = 'BOB';

  identityExchangeEndpoint(app, replicationManager, identityExchange);

  identityExchange.once(IdentityExchange.Events.PeerIdentityExchange, function(peer) {
    completeTest(peer);
  });

  function completeTest(peerToConfirm) {
    request({
      url: webviewIdentityExchangeURL(),
      method: 'GET',
      json: true
    }, function (err, httpResponse, body) {
      t.notOk(err);
      t.equal(httpResponse.statusCode, 200, 'Status code should be 200');
      t.equal(body.peerFriendlyName, peerFriendlyName, 'Body should have peerFriendlyName');
      t.equal(body.peers[0].peerDeviceId, peerToConfirm.peerIdentifier, 'Body should have a peer with peer device ID');
      t.equal(body.peers[0].peerPublicKeyHash, peerToConfirm.peerName, 'Body should have a peer with public key hash');
      t.equal(body.peers[0].peerFriendlyName, peerToConfirm.peerFriendlyName,
        'Body should have a peer with peer friendly name');
      t.end();
    });
  }

  request({
    url: webviewIdentityExchangeURL(),
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');

    if (!jxcore.utils.OSInfo().isMobile) {
      var peerToConfirm = {
        peerIdentifier: 'DEVICE',
        peerName: 'REALLYLONGHASH',
        peerFriendlyName: 'BILL'
      };
      identityExchange.emit(IdentityExchange.Events.PeerIdentityExchange, peerToConfirm);
    }
  });
});

test('PUT /webview/identityexchange/executeexchange without start', function (t) {
  identityExchangeEndpoint(app, replicationManager, identityExchange);

  request({
    url: webviewIdentityExchangeExecuteExchangeURL(),
    method: 'PUT',
    json: true
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 404, 'Status code should be 404');
    t.equal(body.errorCode, 'E_NOCURRENTIDEXCHANGE', 'Error code should be E_NOCURRENTIDEXCHANGE');
    t.end();
  });
});

test('PUT /webview/identityexchange/executeexchange peer device missing', function (t) {
  var peerFriendlyName = 'BOB';

  identityExchangeEndpoint(app, replicationManager, identityExchange);

  request({
    url: webviewIdentityExchangeURL(),
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');

    request({
      url: webviewIdentityExchangeExecuteExchangeURL(),
      method: 'PUT',
      json: true
    }, function (err, httpResponse, body) {
      t.notOk(err);
      t.equal(httpResponse.statusCode, 400, 'Status code should be 400');
      t.equal(body.errorCode, 'E_PEERDEVICEIDMISSING');
      t.end();
    });

  });
});

test('PUT /webview/identityexchange/executeexchange no peer found', function (t) {
  var peerFriendlyName = 'BOB',
    peerDeviceId = 'DEVICEID';

  identityExchangeEndpoint(app, replicationManager, identityExchange);

  request({
    url: webviewIdentityExchangeURL(),
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');

    request({
      url: webviewIdentityExchangeExecuteExchangeURL(),
      method: 'PUT',
      json: true,
      body: { peerDeviceId: peerDeviceId }
    }, function (err, httpResponse, body) {
      t.notOk(err);
      t.equal(httpResponse.statusCode, 400, 'Status code should be 400');
      t.equal(body.errorCode, 'E_PEERDEVICEIDNOTFOUND');
      t.end();
    });

  });
});

test('PUT /webview/identityexchange/executeexchange peer found', function (t) {
  var peerFriendlyName = 'BOB',
    peerDeviceId = 'DEVICEID';

  identityExchangeEndpoint(app, replicationManager, identityExchange);

  identityExchange.once(IdentityExchange.Events.PeerIdentityExchange, function(peer) {
    completeTest(peer);
  });

  function completeTest(peerToConfirm) {
    request({
      url: webviewIdentityExchangeExecuteExchangeURL(),
      method: 'PUT',
      json: true,
      body: { peerDeviceId: peerToConfirm.peerIdentifier }
    }, function (err, httpResponse, body) {
      t.notOk(err);
      t.equal(httpResponse.statusCode, 202, 'Status code should be 202');
      t.equal(body, 'Accepted', 'Body should be accepted');
      t.end();
    });
  }

  request({
    url: webviewIdentityExchangeURL(),
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');

    if (!jxcore.utils.OSInfo().isMobile) {
      var peerToConfirm = {
        peerIdentifier: peerDeviceId,
        peerName: 'REALLYLONGHASH',
        peerFriendlyName: 'BILL'
      };
      identityExchange.emit(IdentityExchange.Events.PeerIdentityExchange, peerToConfirm);
    }
  });
});

test('PUT /webview/identityexchange/executeexchange different peers', function (t) {
  var peerFriendlyName = 'BOB',
    peerDeviceId1 = 'DEVICEID1',
    peerDeviceId2 = 'DEVICEID2';

  replicationManager = new MockReplicationManager();
  identityExchange = new MockIdentityExchange();

  identityExchangeEndpoint(app, replicationManager, identityExchange);

  identityExchange.emit(IdentityExchange.Events.PeerIdentityExchange, {
    peerIdentifier: peerDeviceId1,
    peerName: 'REALLYLONGHASH',
    peerFriendlyName: 'BILL'
  });

  identityExchange.emit(IdentityExchange.Events.PeerIdentityExchange, {
    peerIdentifier: peerDeviceId2,
    peerName: 'REALLYLONGHASH',
    peerFriendlyName: 'BILL'
  });

  request({
    url: webviewIdentityExchangeURL(),
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');
    t.equal(mockIdentityExchangeState._myFriendlyName, peerFriendlyName, 'Should use myFriendlyName');

    request({
      url: webviewIdentityExchangeExecuteExchangeURL(),
      method: 'PUT',
      json: true,
      body: { peerDeviceId: peerDeviceId1 }
    }, function (err, httpResponse, body) {
      t.notOk(err);
      t.equal(httpResponse.statusCode, 202, 'Status code should be 202');
      t.equal(body, 'Accepted', 'Body should be accepted');

      request({
        url: webviewIdentityExchangeExecuteExchangeURL(),
        method: 'PUT',
        json: true,
        body: { peerDeviceId: peerDeviceId2 }
      }, function (err, httpResponse, body) {
        t.notOk(err);
        t.equal(httpResponse.statusCode, 400, 'Status code should be 400');
        t.equal(body.errorCode, 'E_INVALIDEXCHANGE', 'Error code should be E_INVALIDEXCHANGE');
        t.end();
      });
    });
  });
});

test('DELETE /webview/identityexchange/executeexchange before it gets a chance to generate a code', function(t) {
  var peerFriendlyName = 'BOB',
    peerDeviceId = 'DEVICEID';

  replicationManager = new MockReplicationManager();
  identityExchange = new MockIdentityExchange();

  identityExchangeEndpoint(app, replicationManager, identityExchange);

  // Delay sending confirmation code long enough for us to get a pending
  identityExchange.executeIdentityExchange = function (peerIdentifier, otherPkHash, cb) {
    this._state._peerIdentifier = peerIdentifier;
    this._state._otherPkHash = otherPkHash;
    // We never make the cb so no verification code will ever be sent
  };

  identityExchange.once(IdentityExchange.Events.PeerIdentityExchange, function (peer) {
    requestPromise({
      url: webviewIdentityExchangeExecuteExchangeURL(),
      method: 'PUT',
      json: true,
      body: {peerDeviceId: peer.peerIdentifier},
      resolveWithFullResponse: true
    }).catch(function(err) {
      t.fail("Initial PUT failed with " + JSON.stringify(err));
    }).then(function(httpResponse) {
      t.equal(httpResponse.statusCode, 202, 'Status code should be 202');
      t.equal(httpResponse.body, 'Accepted', 'Body should be accepted');
      return requestPromise({
        url: webviewIdentityExchangeExecuteExchangeURL(),
        method: 'GET',
        json: true,
        resolveWithFullResponse: true
      });
    }).catch(function(err) {
      t.fail("Pending GET failed with " + JSON.stringify(err));
    }).then(function(httpResponse) {
      t.equal(httpResponse.statusCode, 200, 'Status code should be 200 for pending');
      t.equal(httpResponse.body.status, 'pending');
      t.equal(httpResponse.body.peerDeviceId, peer.peerIdentifier, 'Pending peer ID');
      return requestPromise({
        url: webviewIdentityExchangeExecuteExchangeURL(),
        method: 'DELETE',
        resolveWithFullResponse: true
      });
    }).catch(function(err) {
      t.fail("DELETE failed with " + JSON.stringify(err));
    }).then(function(httpResponse) {
      t.equal(httpResponse.statusCode, 204, 'Code status should be 204');
      return requestPromise({
        url: webviewIdentityExchangeExecuteExchangeURL(),
        method: 'GET',
        json: true,
        resolveWithFullResponse: true
      });
    }).then(function(httpResponse) {
      t.fail("We should have gotten a 404 but instead got " + JSON.stringify(httpResponse));
    }).catch(function(err) {
      t.equal(err.statusCode, 404, 'Status code for second GET should be 404');
      t.equal(err.error.status, 'error', 'Body should have error status');
      t.equal(err.error.errorCode, 'E_NOCURRENTIDEXCHANGE');
      t.end();
    });
  });

  request({
    url: webviewIdentityExchangeURL(),
    method: 'PUT',
    json: true,
    body: {peerFriendlyName: peerFriendlyName}
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');

    identityExchange.emit(IdentityExchange.Events.PeerIdentityExchange, {
      peerIdentifier: peerDeviceId,
      peerName: 'REALLYLONGHASH',
      peerFriendlyName: 'BILL'
    });
  });
});

test('GET /webview/identityexchange/executeexchange peer pending', function(t) {
  var peerFriendlyName = 'BOB',
    peerDeviceId = 'DEVICEID';

  mockIdentityExchangeState.verificationCode = 12345;
  replicationManager = new MockReplicationManager();
  identityExchange = new MockIdentityExchange();

  identityExchangeEndpoint(app, replicationManager, identityExchange);

  // Hold the verification code callback until we confirm we have received
  // the pending status result.
  var pendingGetPassedPromiseResolve = null;
  var pendingGetPassedPromise = new Promise(function(resolve, reject) {
    pendingGetPassedPromiseResolve = resolve;
  });

  // Delay sending confirmation code long enough for us to get a pending
  identityExchange.executeIdentityExchange = function (peerIdentifier, otherPkHash, cb) {
    this._state._peerIdentifier = peerIdentifier;
    this._state._otherPkHash = otherPkHash;
    var self = this;
    pendingGetPassedPromise.then(function() {
      cb(self._state.executeIdentityExchangeErr, self._state.verificationCode);
    });
  };

  identityExchange.once(IdentityExchange.Events.PeerIdentityExchange, function (peer) {
    requestPromise({
      url: webviewIdentityExchangeExecuteExchangeURL(),
      method: 'PUT',
      json: true,
      body: {peerDeviceId: peer.peerIdentifier},
      resolveWithFullResponse: true
    }).catch(function(err) {
      t.fail("Initial PUT failed with " + JSON.stringify(err));
    }).then(function(httpResponse) {
      t.equal(httpResponse.statusCode, 202, 'Status code should be 202');
      t.equal(httpResponse.body, 'Accepted', 'Body should be accepted');
      return requestPromise({
        url: webviewIdentityExchangeExecuteExchangeURL(),
        method: 'GET',
        json: true,
        resolveWithFullResponse: true
      });
    }).catch(function(err) {
      t.fail("Pending GET failed with " + JSON.stringify(err));
    }).then(function(httpResponse) {
      t.equal(httpResponse.statusCode, 200, 'Status code should be 200 for pending');
      t.equal(httpResponse.body.status, 'pending');
      t.equal(httpResponse.body.peerDeviceId, peer.peerIdentifier, 'Pending peer ID');
      pendingGetPassedPromiseResolve();
      return requestPromise({
        url: webviewIdentityExchangeExecuteExchangeURL(),
        method: 'GET',
        json: true,
        resolveWithFullResponse: true
      });
    }).catch(function(err) {
      t.fail("Validation code GET failed with " + JSON.stringify(err));
    }).then(function(httpResponse) {
      t.equal(httpResponse.statusCode, 200, 'Code status should be 200');
      t.equal(httpResponse.body.status, 'complete', 'Status should be complete');
      t.equal(httpResponse.body.peerDeviceId, peer.peerIdentifier, 'Peer device ID should be present');
      t.equal(httpResponse.body.publicKeyHash, peer.peerName, 'Public key hash should be present');
      t.equal(httpResponse.body.verificationCode, 12345, 'Verification code be present');
      t.end();
    });
  });

  request({
    url: webviewIdentityExchangeURL(),
    method: 'PUT',
    json: true,
    body: {peerFriendlyName: peerFriendlyName}
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');

    identityExchange.emit(IdentityExchange.Events.PeerIdentityExchange, {
      peerIdentifier: peerDeviceId,
      peerName: 'REALLYLONGHASH',
      peerFriendlyName: 'BILL'
    });
  });
});

test('GET /webview/identityexchange/executeexchange peer found', function (t) {
  var peerFriendlyName = 'BOB',
    peerDeviceId = 'DEVICEID';

  mockIdentityExchangeState.verificationCode = 12345;

  identityExchangeEndpoint(app, replicationManager, identityExchange);

  identityExchange.once(IdentityExchange.Events.PeerIdentityExchange, function(peer) {
    startExchange(peer);
  });

  request({
    url: webviewIdentityExchangeURL(),
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');

    if (!jxcore.utils.OSInfo().isMobile) {
      identityExchange.emit(IdentityExchange.Events.PeerIdentityExchange, {
        peerIdentifier: peerDeviceId,
        peerName: 'REALLYLONGHASH',
        peerFriendlyName: 'BILL'
      });
    }
  });

  function startExchange(peerToConfirm) {
    request({
      url: webviewIdentityExchangeExecuteExchangeURL(),
      method: 'PUT',
      json: true,
      body: { peerDeviceId: peerToConfirm.peerIdentifier }
    }, function (err, httpResponse, body) {
      t.notOk(err);
      t.equal(httpResponse.statusCode, 202, 'Status code should be 202');
      t.equal(body, 'Accepted', 'Body should be accepted');

      getVerificationCode(peerToConfirm);
    });
  }

  var verifiedOnce = false;
  function getVerificationCode(peerToConfirm) {
    setTimeout(function() {
      request({
        url: webviewIdentityExchangeExecuteExchangeURL(),
        method: 'GET',
        json: true
      }, function (err, httpResponse, body) {
        t.notOk(err);
        t.equal(httpResponse.statusCode, 200, 'Status code should be 200');

        if (body.status === 'pending') {
          getVerificationCode(peerToConfirm);
          return;
        }

        t.equal(body.status, 'complete', 'Status should be complete');
        t.equal(body.peerDeviceId, peerToConfirm.peerIdentifier, 'Peer device ID should be present');
        t.equal(body.publicKeyHash, peerToConfirm.peerName, 'Public key hash should be present');

        if (!jxcore.utils.OSInfo().isMobile) {
          t.equal(body.verificationCode, 12345, 'Verification code be present');
        } else {
          identityExchangeTestUtils.checkCode(t, body.verificationCode);
        }

        // Now lets make sure we get the same code again
        if (!verifiedOnce) {
          verifiedOnce = true;
          getVerificationCode(peerToConfirm);
        } else {
          t.end();
        }
      });
    }, 10);
  }
});

test('GET /webview/identityexchange/executeexchange error', function (t) {
  var peerFriendlyName = 'BOB',
    peerDeviceId = 'DEVICEID';

  mockIdentityExchangeState.executeIdentityExchangeErr = new Error();

  replicationManager = new MockReplicationManager();
  identityExchange = new MockIdentityExchange();

  identityExchangeEndpoint(app, replicationManager, identityExchange);

  identityExchange.emit(IdentityExchange.Events.PeerIdentityExchange, {
    peerIdentifier: peerDeviceId,
    peerName: 'REALLYLONGHASH',
    peerFriendlyName: 'BILL'
  });

  request({
    url: webviewIdentityExchangeURL(),
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');

    request({
      url: webviewIdentityExchangeExecuteExchangeURL(),
      method: 'PUT',
      json: true,
      body: { peerDeviceId: peerDeviceId }
    }, function (err, httpResponse, body) {
      t.notOk(err);
      t.equal(httpResponse.statusCode, 202, 'Status code should be 202');
      t.equal(body, 'Accepted', 'Body should be accepted');

      request({
        url: webviewIdentityExchangeExecuteExchangeURL(),
        method: 'GET',
        json: true
      }, function (err, httpResponse, body) {
        t.notOk(err);
        t.equal(httpResponse.statusCode, 500, 'Status code should be 500');
        t.equal(body.status, 'error', 'Status should be complete');
        t.equal(body.errorCode, 'E_STARTEXECUTEIDEXCHANGEFAILED', 'Error code should be E_STARTEXECUTEIDEXCHANGEFAILED');
        t.end();
      });
    });
  });
});

test('DELETE /webview/deviceidentity with valid entry', function (t) {
  identityExchangeEndpoint(app, replicationManager, identityExchange);

  request({
    url: webviewIdentityExchangeExecuteExchangeURL(),
    method: 'DELETE',
    json: true
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 404, 'Status code should be 404, not 200!!!! as Matt tried to put in.');
    t.equal(body.errorCode, 'E_NOCURRENTIDEXCHANGE', 'Error code should be E_NOCURRENTIDEXCHANGE');
    t.end();
  });
});

test('GET /webview/identityexchange/executeexchange peer found', function (t) {
  var peerFriendlyName = 'BOB',
    peerDeviceId = 'DEVICEID';

  identityExchangeEndpoint(app, replicationManager, identityExchange);

  identityExchange.once(IdentityExchange.Events.PeerIdentityExchange, function(peer) {
    request({
      url: webviewIdentityExchangeExecuteExchangeURL(),
      method: 'PUT',
      json: true,
      body: { peerDeviceId: peer.peerIdentifier }
    }, function (err, httpResponse, body) {
      t.notOk(err);
      t.equal(httpResponse.statusCode, 202, 'Status code should be 202');
      t.equal(body, 'Accepted', 'Body should be accepted');

      request({
        url: webviewIdentityExchangeExecuteExchangeURL(),
        method: 'DELETE',
        json: true
      }, function (err, httpResponse, body) {
        t.notOk(err);
        t.equal(httpResponse.statusCode, 204, 'Status code should be 204');
        t.end();
      });
    });
  });

  request({
    url: webviewIdentityExchangeURL(),
    method: 'PUT',
    json: true,
    body: { peerFriendlyName: peerFriendlyName }
  }, function (err, httpResponse, body) {
    t.notOk(err);
    t.equal(httpResponse.statusCode, 201, 'Status code should be 201');
    t.equal(body, 'Created', 'Body should be Created');

    if (!jxcore.utils.OSInfo().isMobile) {
      identityExchange.emit(IdentityExchange.Events.PeerIdentityExchange, {
        peerIdentifier: peerDeviceId,
        peerName: 'REALLYLONGHASH',
        peerFriendlyName: 'BILL'
      });
    }
  });
});

test('Do the whole life cycle a few times', function(t) {
  var peerFriendlyName = 'BOB',
    peerDeviceId = 'DEVICEID';

  mockIdentityExchangeState.verificationCode = 12345;

  identityExchangeEndpoint(app, replicationManager, identityExchange);

  var requestCountDown = 3;

  function doGetUntilCode(peer) {
    return requestPromise({
      url: webviewIdentityExchangeExecuteExchangeURL(),
      method: 'GET',
      json: true,
      resolveWithFullResponse: true
    }).then(function(httpResponse) {
      t.equal(httpResponse.statusCode, 200, 'Status could should be 200');
      if (httpResponse.body.status === 'pending') {
        return new Promise(function(resolve, reject) {
          setTimeout(function() {
            doGetUntilCode(peer)
              .then(function(result) {
                resolve(result);
              }).catch(function(err) {
                reject(err);
              });
          });
        });
      }
      t.equal(httpResponse.body.status, 'complete', 'Status should be complete');
      t.equal(httpResponse.body.peerDeviceId, peer.peerIdentifier, 'Peer device ID should be present');
      t.equal(httpResponse.body.publicKeyHash, peer.peerName, 'Public key hash should be present');

      if (!jxcore.utils.OSInfo().isMobile) {
        t.equal(httpResponse.body.verificationCode, 12345, 'Verification code be present');
      } else {
        identityExchangeTestUtils.checkCode(t, httpResponse.body.verificationCode);
      }
    })
  }

  function startRequests() {
    identityExchange.once(IdentityExchange.Events.PeerIdentityExchange, function (peer) {
      return requestPromise({
        url: webviewIdentityExchangeExecuteExchangeURL(),
        method: 'PUT',
        json: true,
        body: { peerDeviceId: peer.peerIdentifier },
        resolveWithFullResponse: true
      }).catch(function(err) {
        t.fail('Second PUT failed with ' + JSON.stringify(err));
      }).then(function(httpResponse) {
        t.equal(httpResponse.statusCode, 202, 'Second PUT gives us a 202');
        return doGetUntilCode(peer);
      }).catch(function(err) {
        t.fail('Get until code failed with ' + JSON.stringify(err));
      }).then(function() {
        return requestPromise({
          url: webviewIdentityExchangeExecuteExchangeURL(),
          method: 'DELETE',
          json: true,
          resolveWithFullResponse: true
        });
      }).catch(function(err) {
        t.fail('First DELETE failed with ' + JSON.stringify(err));
      }).then(function(httpResponse) {
        t.equal(httpResponse.statusCode, 204, 'First DELETE should be 204');
        return requestPromise({
          url: webviewIdentityExchangeURL(),
          method: 'DELETE',
          json: true,
          resolveWithFullResponse: true
        });
      }).catch(function(err) {
        t.fail('Second DELETE failed with ' + JSON.stringify(err));
      }).then(function(httpResponse) {
        t.equal(httpResponse.statusCode, 204, 'Second DELETE should be 204');
        requestCountDown -= 1;
        if (requestCountDown === 0) {
          t.end();
        } else {
          return startRequests();
        }
      })
    });

    requestPromise({
      url: webviewIdentityExchangeURL(),
      method: 'PUT',
      json: true,
      body: { peerFriendlyName: peerFriendlyName },
      resolveWithFullResponse: true
    }).catch(function(err) {
      t.fail("First PUT failed with " + JSON.stringify(err));
    }).then(function(httpResponse) {
      t.equal(httpResponse.statusCode, 201, 'First PUT gives us a 201');


      if (!jxcore.utils.OSInfo().isMobile) {
        identityExchange.emit(IdentityExchange.Events.PeerIdentityExchange, {
          peerIdentifier: peerDeviceId,
          peerName: 'REALLYLONGHASH',
          peerFriendlyName: 'BILL'
        });
      }
    });
  }

  startRequests();
});
