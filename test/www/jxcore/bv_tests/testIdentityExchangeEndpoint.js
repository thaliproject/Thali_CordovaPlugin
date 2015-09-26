/* jshint node: true, undef: true, unused: true  */
'use strict';

var request = require('request');
var tape = require('../lib/thali-tape');
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
        t.comment("Server emited an error event - " + JSON.stringify(err));
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
    console.log("Entered teardown section");
    server.close(function() {
      console.log("Got past server.close()");
      resetExchangeState();
      if (replicationManager instanceof ThaliReplicationManager) {
        console.log("About to call stopThaliReplicationManager");
        identityExchangeUtils.stopThaliReplicationManager(replicationManager)
          .then(function() {
            console.log("Got back from stopThaliReplicationManager");
            t.end();
          }).catch(function(err) {
            t.fail("stopThaliReplicationManager failed with " + JSON.stringify(err));
          });
      } else {
        t.end();
      }
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

  function getVerificationCode(peerToConfirm) {
    setTimeout(function() {
      request({
        url: webviewIdentityExchangeExecuteExchangeURL(),
        method: 'GET',
        json: true
      }, function (err, httpResponse, body) {
        t.notOk(err);
        if (httpResponse.statusCode != 200) {
          getVerificationCode(peerToConfirm);
          return;
        }
        t.equal(httpResponse.statusCode, 200, 'Status code should be 200');
        t.equal(body.status, 'complete', 'Status should be complete');
        t.equal(body.peerDeviceId, peerToConfirm.peerIdentifier, 'Peer device ID should be present');
        t.equal(body.publicKeyHash, peerToConfirm.peerName, 'Public key hash should be present');

        if (!jxcore.utils.OSInfo().isMobile) {
          t.equal(body.verificationCode, 12345, 'Verification code be present');
        }
        t.end();
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
