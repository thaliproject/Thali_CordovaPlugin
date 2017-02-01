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

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

test(
  'ssdp server should be restarted when wifi toggled',
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
      sinon.spy(wifiInfrastructure._getSSDPServer(), 'start');
    var serverStopSpy  =
      sinon.spy(wifiInfrastructure._getSSDPServer(), 'stop');

    wifiInfrastructure.start(express.Router(), pskIdToSecret)
      .then(function () {
        t.ok(wifiInfrastructure._getCurrentState().started,
          'should be in started state');
      })
      .then(function () {
        return wifiInfrastructure.startUpdateAdvertisingAndListening();
      })
      .then(function () {
        t.ok(serverStartSpy.calledOnce, 'server start should be called once');
        t.ok(!serverStopSpy.called,     'server stop should not be called');

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

        return wifiInfrastructure.stop();
      })
      .then(function () {
        t.ok(serverStopSpy.calledTwice, 'server stop should be called twice');
        t.ok(!wifiInfrastructure._getCurrentState().started,
          'should not be in started state');
        serverStartSpy.restore();
        serverStopSpy.restore();
        t.end();
      });
  }
);

test(
  'ssdp server should be restarted when bssid changed',
  function () {
    return global.NETWORK_TYPE !== networkTypes.WIFI;
  },
  function (t) {
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

    var wifiInfrastructure = new ThaliWifiInfrastructure();
    var ssdpServer = wifiInfrastructure._getSSDPServer();
    var startStub = sinon.stub(ssdpServer, 'start', function (cb) {
      cb();
    });
    var stopStub = sinon.stub(ssdpServer, 'stop', function (cb) {
      cb();
    });

    function testBssidChangeReaction (newBssid) {
      // reset call counts
      startStub.reset();
      stopStub.reset();
      return new Promise(function (resolve) {
        changeBssid(newBssid);
        setImmediate(function () {
          t.equal(stopStub.callCount, 1, 'start called once');
          t.equal(startStub.callCount, 1, 'start called once');
          resolve();
        });
      });
    }

    wifiInfrastructure.start(express.Router(), pskIdToSecret)
      .then(function () {
        return wifiInfrastructure.startUpdateAdvertisingAndListening();
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
        startStub.restore();
        stopStub.restore();
        t.end();
      });
  }
);
