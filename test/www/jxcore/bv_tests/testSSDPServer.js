'use strict';

var tape      = require('../lib/thaliTape');

var Promise = require('bluebird');
var sinon   = require('sinon');
var express = require('express');

var ThaliMobile              = require('thali/NextGeneration/thaliMobile');
var ThaliMobileNativeWrapper = require('thali/NextGeneration/thaliMobileNativeWrapper');
var ThaliWifiInfrastructure  = require('thali/NextGeneration/thaliWifiInfrastructure');

var networkTypes = ThaliMobile.networkTypes;

function pskIdToSecret () {
  return null;
}

function callArg(arg) {
  arg();
}

var sandbox = null;

var test = tape({
  setup: function (t) {
    sandbox = sinon.sandbox.create();
    t.end();
  },
  teardown: function (t) {
    sandbox.restore();
    sandbox = null;
    t.end();
  }
});

test(
  'ssdp server and client should be restarted when wifi toggled',
  function () {
    return global.NETWORK_TYPE !== networkTypes.WIFI;
  },
  function (t) {
    function toggleWifi(value) {
      ThaliMobileNativeWrapper.emitter.emit('networkChangedNonTCP', {
        wifi:               value? 'on' : 'off',
        bluetooth:          'on',
        bluetoothLowEnergy: 'on',
        cellular:           'on',
        bssidName:          '00:00:00:00:00:00',
        ssidName:           'WiFi Network'
      });
    }

    var wifiInfrastructure = new ThaliWifiInfrastructure();
    var serverStartSpy =
      sandbox.spy(wifiInfrastructure._getSSDPServer(), 'start');
    var serverStopSpy  =
      sandbox.spy(wifiInfrastructure._getSSDPServer(), 'stop');
    var clientStartSpy =
      sandbox.spy(wifiInfrastructure._getSSDPClient(), 'start');
    var clientStopSpy  =
      sandbox.spy(wifiInfrastructure._getSSDPClient(), 'stop');

    wifiInfrastructure.start(express.Router(), pskIdToSecret)
      .then(function () {
        t.ok(wifiInfrastructure._getCurrentState().started,
          'should be in started state');
      })
      .then(function () {
        return wifiInfrastructure.startUpdateAdvertisingAndListening();
      })
      .then(function () {
        return wifiInfrastructure.startListeningForAdvertisements();
      })
      .then(function () {
        t.ok(serverStartSpy.calledOnce, 'server start should be called once');
        t.ok(!serverStopSpy.called,     'server stop should not be called');
        t.ok(clientStartSpy.calledOnce, 'client start should be called once');
        t.ok(!clientStopSpy.called,     'client stop should not be called');

        return new Promise(function (resolve) {
          toggleWifi(false);
          setTimeout(function () {
            toggleWifi(true);
            setTimeout(resolve, 100);
          }, 100);
        });
      })
      .then(function () {
        t.ok(serverStartSpy.calledTwice, 'server start should be called twice');
        t.ok(serverStopSpy.calledOnce,   'server stop should be called once');
        t.ok(clientStartSpy.calledTwice, 'client start should be called twice');
        t.ok(clientStopSpy.calledOnce,   'client stop should be called once');

        return wifiInfrastructure.stop();
      })
      .then(function () {
        t.ok(serverStopSpy.calledTwice, 'server stop should be called twice');
        t.ok(clientStopSpy.calledTwice, 'client stop should be called twice');
        t.ok(!wifiInfrastructure._getCurrentState().started,
          'should not be in started state');
        t.end();
      });
  }
);

function changeBssid (value) {
  ThaliMobileNativeWrapper.emitter.emit('networkChangedNonTCP', {
    wifi:               'on',
    bluetooth:          'on',
    bluetoothLowEnergy: 'on',
    cellular:           'on',
    bssidName:          value,
    ssidName:           (value === null) ? null : 'WiFi Network'
  });
}

test(
  'ssdp server and client should be restarted when bssid changed',
  function () {
    return global.NETWORK_TYPE !== networkTypes.WIFI;
  },
  function (t) {
    var wifiInfrastructure = new ThaliWifiInfrastructure();
    var ssdpServer = wifiInfrastructure._getSSDPServer();
    var ssdpClient = wifiInfrastructure._getSSDPClient();
    var serverStartStub = sandbox.stub(ssdpServer, 'start', callArg);
    var serverStopStub = sandbox.stub(ssdpServer, 'stop', callArg);
    var clientStartStub = sandbox.stub(ssdpClient, 'start', callArg);
    var clientStopStub = sandbox.stub(ssdpClient, 'stop', callArg);

    function testBssidChangeReaction (newBssid) {
      // reset call counts
      serverStartStub.reset();
      serverStopStub.reset();
      clientStartStub.reset();
      clientStopStub.reset();
      return new Promise(function (resolve) {
        changeBssid(newBssid);
        setImmediate(function () {
          t.equal(serverStartStub.callCount, 1, 'server start called once');
          t.equal(serverStopStub.callCount, 1, 'server stop called once');
          t.equal(clientStartStub.callCount, 1, 'client start called once');
          t.equal(clientStopStub.callCount, 1, 'client start called once');
          t.ok(serverStopStub.calledBefore(serverStartStub),
            'server stop called before start');
          t.ok(clientStopStub.calledBefore(clientStartStub),
            'client stop called before start');
          resolve();
        });
      });
    }

    wifiInfrastructure.start(express.Router(), pskIdToSecret)
      .then(function () {
        return wifiInfrastructure.startUpdateAdvertisingAndListening();
      })
      .then(function () {
        return wifiInfrastructure.startListeningForAdvertisements();
      })
      .then(function () {
        // bssid -> null
        return testBssidChangeReaction(null);
      })
      .then(function () {
        // null -> bssid
        return testBssidChangeReaction('00:00:00:00:00:00');
      })
      .then(function () {
        // bssid -> another bssid
        return testBssidChangeReaction('11:11:11:11:11:11');
      })
      .then(function () {
        return wifiInfrastructure.stop();
      })
      .catch(function (error) {
        t.fail('Test failed:' + error.message + '. ' + error.stack);
      })
      .then(function () {
        t.ok(!wifiInfrastructure._getCurrentState().started,
          'should not be in started state');
        t.end();
      });
  }
);

test(
  'ssdp server and client should be restarted only when ' +
  'advertising/listening is active',
  function () {
    return global.NETWORK_TYPE !== networkTypes.WIFI;
  },
  function (t) {
    var wifiInfrastructure = new ThaliWifiInfrastructure();
    var ssdpServer = wifiInfrastructure._getSSDPServer();
    var ssdpClient = wifiInfrastructure._getSSDPClient();
    var serverStartStub = sandbox.stub(ssdpServer, 'start', callArg);
    var serverStopStub = sandbox.stub(ssdpServer, 'stop', callArg);
    var clientStartStub = sandbox.stub(ssdpClient, 'start', callArg);
    var clientStopStub = sandbox.stub(ssdpClient, 'stop', callArg);

    function testBssidChangeReaction (newBssid) {
      return new Promise(function (resolve) {
        changeBssid(newBssid);
        setImmediate(function () {
          t.equal(serverStartStub.callCount, 0, 'server start never called');
          t.equal(serverStopStub.callCount, 0, 'server stop never called');
          t.equal(clientStartStub.callCount, 0, 'client start never called');
          t.equal(clientStopStub.callCount, 0, 'client start never called');
          resolve();
        });
      });
    }

    wifiInfrastructure.start(express.Router(), pskIdToSecret)
      .then(function () {
        // bssid -> null
        return testBssidChangeReaction(null);
      })
      .then(function () {
        // null -> bssid
        return testBssidChangeReaction('00:00:00:00:00:00');
      })
      .then(function () {
        // bssid -> another bssid
        return testBssidChangeReaction('11:11:11:11:11:11');
      })
      .then(function () {
        return wifiInfrastructure.stop();
      })
      .catch(function (error) {
        t.fail('Test failed:' + error.message + '. ' + error.stack);
      })
      .then(function () {
        t.ok(!wifiInfrastructure._getCurrentState().started,
          'should not be in started state');
        t.end();
      });
  }
);
