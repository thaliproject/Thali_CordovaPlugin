'use strict';

var tape      = require('../lib/thaliTape');

var Promise = require('bluebird');
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

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

test(
  'ssdp server and client should be restarted when wifi toggled',
  function () {
    return global.NETWORK_TYPE !== networkTypes.WIFI;
  },
  tape.sinonTest(function (t) {
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
      this.spy(wifiInfrastructure._getSSDPServer(), 'start');
    var serverStopSpy  =
      this.spy(wifiInfrastructure._getSSDPServer(), 'stop');
    var clientStartSpy =
      this.spy(wifiInfrastructure._getSSDPClient(), 'start');
    var clientStopSpy  =
      this.spy(wifiInfrastructure._getSSDPClient(), 'stop');

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
  })
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

function testBssidChangeReaction (context, newBssid, callCount) {
  var t = context.t;
  var stubs = context.stubs;
  // reset call counts
  stubs.serverStart.reset();
  stubs.serverStop.reset();
  stubs.clientStart.reset();
  stubs.clientStop.reset();
  return new Promise(function (resolve) {
    changeBssid(newBssid);
    // TODO: #1805
    setTimeout(function () {
      t.equal(stubs.serverStart.callCount, callCount.start,
        'server start called ' + callCount.start + ' times');
      t.equal(stubs.serverStop.callCount, callCount.stop,
        'server stop called ' + callCount.stop + ' times');
      t.equal(stubs.clientStart.callCount, callCount.start,
        'client start called ' + callCount.start + ' times');
      t.equal(stubs.clientStop.callCount, callCount.stop,
        'client stop called ' + callCount.stop + ' times');
      if (callCount.start === 1 && callCount.stop === 1) {
        t.ok(stubs.serverStop.calledBefore(stubs.serverStart),
          'server stop called before start');
        t.ok(stubs.clientStop.calledBefore(stubs.clientStart),
          'client stop called before start');
      }
      resolve();
    }, 200);
  });
}


test(
  'ssdp server and client should be restarted when bssid changed',
  function () {
    return global.NETWORK_TYPE !== networkTypes.WIFI;
  },
  tape.sinonTest(function (t) {
    var wifiInfrastructure = new ThaliWifiInfrastructure();
    var ssdpServer = wifiInfrastructure._getSSDPServer();
    var ssdpClient = wifiInfrastructure._getSSDPClient();
    var stubs = {
      serverStart: this.stub(ssdpServer, 'start', callArg),
      serverStop: this.stub(ssdpServer, 'stop', callArg),
      clientStart: this.stub(ssdpClient, 'start', callArg),
      clientStop: this.stub(ssdpClient, 'stop', callArg)
    };
    var context = { t: t, stubs: stubs };
    var testBssid = testBssidChangeReaction.bind(null, context);

    wifiInfrastructure.start(express.Router(), pskIdToSecret)
      .then(function () {
        return wifiInfrastructure.startUpdateAdvertisingAndListening();
      })
      .then(function () {
        return wifiInfrastructure.startListeningForAdvertisements();
      })
      .then(function () {
        // bssid -> null
        var callCount = { stop: 1, start: 0 };
        return testBssid(null, callCount);
      })
      .then(function () {
        // null -> bssid
        var callCount = { stop: 0, start: 1 };
        return testBssid('00:00:00:00:00:00', callCount);
      })
      .then(function () {
        // bssid -> another bssid
        var callCount = { stop: 1, start: 1 };
        return testBssid('11:11:11:11:11:11', callCount);
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
  })
);

test(
  'ssdp server and client should be restarted only when ' +
  'advertising/listening is active',
  function () {
    return global.NETWORK_TYPE !== networkTypes.WIFI;
  },
  tape.sinonTest(function (t) {
    var wifiInfrastructure = new ThaliWifiInfrastructure();
    var ssdpServer = wifiInfrastructure._getSSDPServer();
    var ssdpClient = wifiInfrastructure._getSSDPClient();
    var stubs = {
      serverStart: this.stub(ssdpServer, 'start', callArg),
      serverStop: this.stub(ssdpServer, 'stop', callArg),
      clientStart: this.stub(ssdpClient, 'start', callArg),
      clientStop: this.stub(ssdpClient, 'stop', callArg)
    };
    var context = { t: t, stubs: stubs };
    var testBssid = testBssidChangeReaction.bind(null, context);

    wifiInfrastructure.start(express.Router(), pskIdToSecret)
      .then(function () {
        // bssid -> null
        return testBssid(null, { start: 0, stop: 0 });
      })
      .then(function () {
        // null -> bssid
        return testBssid('00:00:00:00:00:00', { start: 0, stop: 0 });
      })
      .then(function () {
        // bssid -> another bssid
        return testBssid('11:11:11:11:11:11', { start: 0, stop: 0 });
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
  })
);
