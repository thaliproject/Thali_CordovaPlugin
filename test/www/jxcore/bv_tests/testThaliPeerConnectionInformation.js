'use strict';

var tape = require('../lib/thaliTape');

var PeerConnectionInformation =
  require('thali/NextGeneration/notification/thaliPeerConnectionInformation');
var ThaliMobileNativeWrapper =
  require('thali/NextGeneration/thaliMobileNativeWrapper');

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

test('Test PeerConnectionInformation basics', function (t) {

  var connInfo = new PeerConnectionInformation(
    ThaliMobileNativeWrapper.connectionTypes.TCP_NATIVE,
    '127.0.0.1', 123, 10);

  t.equals( connInfo.getConnectionType(),
    ThaliMobileNativeWrapper.connectionTypes.TCP_NATIVE, 'connection type works');

  t.equals( connInfo.getHostAddress(),
    '127.0.0.1', 'getHostAddress works');

  t.equals( connInfo.getPortNumber(),
    123, 'getPortNumber works');

  t.equals( connInfo.getSuggestedTCPTimeout(),
    10, 'getSuggestedTCPTimeout works');

  t.end();
});
